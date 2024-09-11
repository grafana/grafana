package service

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
)

const (
	maxListQueryLength = 8
	maxListQueryLimit  = 100
)

type searchResult struct {
	runner   string
	result   []dashboards.DashboardSearchProjection
	err      error
	duration time.Duration
}

func (dr *DashboardServiceImpl) FindDashboardsZanzana(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error) {
	if dr.cfg.Zanzana.SingleRead {
		return dr.findDashboardsZanzanaSingleRead(ctx, query)
	}
	return dr.findDashboardsZanzanaCompare(ctx, query)
}

func (dr *DashboardServiceImpl) findDashboardsZanzanaSingleRead(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error) {
	timer := prometheus.NewTimer(dr.metrics.searchRequestsDuration.WithLabelValues("zanzana"))
	defer timer.ObserveDuration()

	return dr.findDashboardsZanzana(ctx, query)
}

func (dr *DashboardServiceImpl) findDashboardsZanzanaCompare(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error) {
	result := make(chan searchResult, 2)

	go func() {
		timer := prometheus.NewTimer(dr.metrics.searchRequestsDuration.WithLabelValues("zanzana"))
		defer timer.ObserveDuration()
		start := time.Now()

		queryZanzana := *query
		res, err := dr.findDashboardsZanzana(ctx, &queryZanzana)
		result <- searchResult{"zanzana", res, err, time.Since(start)}
	}()

	go func() {
		timer := prometheus.NewTimer(dr.metrics.searchRequestsDuration.WithLabelValues("grafana"))
		defer timer.ObserveDuration()
		start := time.Now()

		res, err := dr.FindDashboards(ctx, query)
		result <- searchResult{"grafana", res, err, time.Since(start)}
	}()

	first, second := <-result, <-result
	close(result)

	if second.runner == "grafana" {
		first, second = second, first
	}

	if second.err != nil {
		dr.log.Error("zanzana search failed", "error", second.err)
	} else if len(first.result) != len(second.result) {
		dr.log.Warn(
			"zanzana search result does not match grafana",
			"grafana_result_len", len(first.result),
			"zanana_result_len", len(second.result),
			"grafana_duration", first.duration,
			"zanzana_duration", second.duration,
		)
	} else {
		dr.log.Debug("zanzana search is correct", "result_len", len(first.result), "grafana_duration", first.duration, "zanzana_duration", second.duration)
	}

	return first.result, first.err
}

func (dr *DashboardServiceImpl) findDashboardsZanzana(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error) {
	findDashboards := dr.getFindDashboardsFn(query)
	return findDashboards(ctx, query)
}

type findDashboardsFn func(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error)

// getFindDashboardsFn makes a decision which search method should be used
func (dr *DashboardServiceImpl) getFindDashboardsFn(query *dashboards.FindPersistedDashboardsQuery) findDashboardsFn {
	if query.Limit > 0 && query.Limit < maxListQueryLimit && len(query.Title) > 0 {
		return dr.findDashboardsZanzanaCheck
	}
	if len(query.DashboardUIDs) > 0 && len(query.DashboardUIDs) < maxListQueryLimit {
		return dr.findDashboardsZanzanaCheck
	}
	if len(query.FolderUIDs) > 0 && len(query.FolderUIDs) < maxListQueryLimit {
		return dr.findDashboardsZanzanaCheck
	}
	if len(query.Title) <= maxListQueryLength {
		return dr.findDashboardsZanzanaList
	}
	return dr.findDashboardsZanzanaCheck
}

func (dr *DashboardServiceImpl) findDashboardsZanzanaList(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.findDashboardsZanzanaList")
	defer span.End()

	var wg sync.WaitGroup
	resChan := make(chan []string, 2)
	errChan := make(chan error, 2)

	// For some search types we need dashboards or folders only
	if query.Type != searchstore.TypeFolder && query.Type != searchstore.TypeAlertFolder {
		wg.Add(1)
		go func() {
			defer wg.Done()
			dashboardUIDs, err := dr.listResources(ctx, query, zanzana.TypeDashboard)
			if err != nil {
				errChan <- err
				return
			}
			resChan <- dashboardUIDs
			errChan <- nil
		}()
	}

	if query.Type != searchstore.TypeDashboard {
		wg.Add(1)
		go func() {
			defer wg.Done()
			folderUIDs, err := dr.listResources(ctx, query, zanzana.TypeFolder)
			if err != nil {
				errChan <- err
				return
			}
			resChan <- folderUIDs
			errChan <- nil
		}()
	}

	wg.Wait()
	close(resChan)
	close(errChan)

	for err := range errChan {
		if err != nil {
			return nil, err
		}
	}

	uids := make([]string, 0)
	for res := range resChan {
		uids = append(uids, res...)
	}

	query.DashboardUIDs = append(uids, query.DashboardUIDs...)
	query.SkipAccessControlFilter = true
	return dr.dashboardStore.FindDashboards(ctx, query)
}

func (dr *DashboardServiceImpl) listResources(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery, resourceType string) ([]string, error) {
	res, err := dr.ac.ListObjects(ctx, accesscontrol.ListObjectsRequest{
		User:     query.SignedInUser.GetUID(),
		Type:     resourceType,
		Relation: "read",
	})
	if err != nil {
		return nil, err
	}

	orgId := query.OrgId
	if orgId == 0 && query.SignedInUser.GetOrgID() != 0 {
		orgId = query.SignedInUser.GetOrgID()
	}
	// dashboard:<orgId>-
	prefix := fmt.Sprintf("%s:%d-", resourceType, orgId)

	resourceUIDs := make([]string, 0)
	for _, d := range res {
		if uid, found := strings.CutPrefix(d, prefix); found {
			resourceUIDs = append(resourceUIDs, uid)
		}
	}

	return resourceUIDs, nil
}

func (dr *DashboardServiceImpl) findDashboardsZanzanaCheck(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.findDashboardsZanzanaCheck")
	defer span.End()

	query.SkipAccessControlFilter = true
	findRes, err := dr.dashboardStore.FindDashboards(ctx, query)
	if err != nil {
		return nil, err
	}

	return dr.checkDashboards(ctx, query, findRes)
}

func (dr *DashboardServiceImpl) checkDashboards(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery, searchRes []dashboards.DashboardSearchProjection) ([]dashboards.DashboardSearchProjection, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.checkDashboards")
	defer span.End()

	orgId := query.OrgId
	if orgId == 0 && query.SignedInUser.GetOrgID() != 0 {
		orgId = query.SignedInUser.GetOrgID()
	}

	concurrentRequests := dr.cfg.Zanzana.ConcurrentChecks
	res := make([]dashboards.DashboardSearchProjection, 0)
	resToCheck := make(chan dashboards.DashboardSearchProjection, concurrentRequests)
	allowedResults := make(chan dashboards.DashboardSearchProjection, len(searchRes))
	errChan := make(chan error, len(searchRes))
	var wg sync.WaitGroup
	for i := 0; i < int(concurrentRequests); i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for d := range resToCheck {
				objectType := zanzana.TypeDashboard
				if d.IsFolder {
					objectType = zanzana.TypeFolder
				}
				object := zanzana.NewScopedTupleEntry(objectType, d.UID, "", strconv.FormatInt(orgId, 10))
				req := accesscontrol.CheckRequest{
					User:     query.SignedInUser.GetUID(),
					Relation: "read",
					Object:   object,
				}

				allowed, err := dr.ac.Check(ctx, req)
				if err != nil {
					errChan <- err
					dr.log.Error("error checking access", "error", err)
				} else if allowed {
					allowedResults <- d
				}
			}
		}()
	}

	for _, r := range searchRes {
		resToCheck <- r
	}
	close(resToCheck)

	wg.Wait()
	close(allowedResults)
	for r := range allowedResults {
		res = append(res, r)
	}

	return res, nil
}
