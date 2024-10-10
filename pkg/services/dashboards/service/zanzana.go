package service

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/authlib/claims"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

const (
	// If search query string shorter than this value, then "List, then check" strategy will be used
	listQueryLengthThreshold = 8
	// If query limit set to value higher than this value, then "List, then check" strategy will be used
	listQueryLimitThreshold = 50
	defaultQueryLimit       = 1000
)

type searchResult struct {
	runner   string
	result   []dashboards.DashboardSearchProjection
	err      error
	duration time.Duration
}

func (dr *DashboardServiceImpl) FindDashboardsZanzana(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error) {
	if dr.cfg.Zanzana.ZanzanaOnlyEvaluation {
		return dr.findDashboardsZanzanaOnly(ctx, *query)
	}
	return dr.findDashboardsZanzanaCompare(ctx, *query)
}

func (dr *DashboardServiceImpl) findDashboardsZanzanaOnly(ctx context.Context, query dashboards.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error) {
	timer := prometheus.NewTimer(dr.metrics.searchRequestsDuration.WithLabelValues("zanzana"))
	defer timer.ObserveDuration()

	return dr.findDashboardsZanzana(ctx, query)
}

func (dr *DashboardServiceImpl) findDashboardsZanzanaCompare(ctx context.Context, query dashboards.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error) {
	result := make(chan searchResult, 2)

	go func() {
		timer := prometheus.NewTimer(dr.metrics.searchRequestsDuration.WithLabelValues("zanzana"))
		defer timer.ObserveDuration()
		start := time.Now()

		queryZanzana := query
		res, err := dr.findDashboardsZanzana(ctx, queryZanzana)
		result <- searchResult{"zanzana", res, err, time.Since(start)}
	}()

	go func() {
		timer := prometheus.NewTimer(dr.metrics.searchRequestsDuration.WithLabelValues("grafana"))
		defer timer.ObserveDuration()
		start := time.Now()

		res, err := dr.FindDashboards(ctx, &query)
		result <- searchResult{"grafana", res, err, time.Since(start)}
	}()

	first, second := <-result, <-result
	close(result)

	if second.runner == "grafana" {
		first, second = second, first
	}

	if second.err != nil {
		dr.log.Error("zanzana search failed", "error", second.err)
		dr.metrics.searchRequestStatusTotal.WithLabelValues("error").Inc()
	} else if len(first.result) != len(second.result) {
		dr.metrics.searchRequestStatusTotal.WithLabelValues("error").Inc()
		dr.log.Warn(
			"zanzana search result does not match grafana",
			"grafana_result_len", len(first.result),
			"zanana_result_len", len(second.result),
			"grafana_duration", first.duration,
			"zanzana_duration", second.duration,
		)
	} else {
		dr.metrics.searchRequestStatusTotal.WithLabelValues("success").Inc()
		dr.log.Debug("zanzana search is correct", "result_len", len(first.result), "grafana_duration", first.duration, "zanzana_duration", second.duration)
	}

	return first.result, first.err
}

func (dr *DashboardServiceImpl) findDashboardsZanzana(ctx context.Context, query dashboards.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error) {
	findDashboards := dr.getFindDashboardsFn(query)
	return findDashboards(ctx, query)
}

type findDashboardsFn func(ctx context.Context, query dashboards.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error)

// getFindDashboardsFn makes a decision which search method should be used
func (dr *DashboardServiceImpl) getFindDashboardsFn(query dashboards.FindPersistedDashboardsQuery) findDashboardsFn {
	if query.Limit > 0 && query.Limit < listQueryLimitThreshold && len(query.Title) > 0 {
		return dr.findDashboardsZanzanaCheck
	}
	if len(query.DashboardUIDs) > 0 || len(query.DashboardIds) > 0 {
		return dr.findDashboardsZanzanaCheck
	}
	if len(query.FolderUIDs) > 0 {
		return dr.findDashboardsZanzanaCheck
	}
	if len(query.Title) <= listQueryLengthThreshold {
		return dr.findDashboardsZanzanaList
	}
	return dr.findDashboardsZanzanaCheck
}

// findDashboardsZanzanaCheck implements "Search, then check" strategy. It first performs search query, then filters out results
// by checking access to each item.
func (dr *DashboardServiceImpl) findDashboardsZanzanaCheck(ctx context.Context, query dashboards.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.findDashboardsZanzanaCheck")
	defer span.End()

	result := make([]dashboards.DashboardSearchProjection, 0, query.Limit)
	var page int64 = 1
	query.SkipAccessControlFilter = true
	// Remember initial query limit
	limit := query.Limit
	// Set limit to default to prevent pagination issues
	query.Limit = defaultQueryLimit

	for len(result) < int(limit) {
		query.Page = page
		findRes, err := dr.dashboardStore.FindDashboards(ctx, &query)
		if err != nil {
			return nil, err
		}

		remains := limit - int64(len(result))
		res, err := dr.checkDashboards(ctx, query, findRes, remains)
		if err != nil {
			return nil, err
		}

		result = append(result, res...)
		page++

		// Stop when last page reached
		if len(findRes) < defaultQueryLimit {
			break
		}
	}

	return result, nil
}

func (dr *DashboardServiceImpl) checkDashboards(ctx context.Context, query dashboards.FindPersistedDashboardsQuery, searchRes []dashboards.DashboardSearchProjection, remains int64) ([]dashboards.DashboardSearchProjection, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.checkDashboards")
	defer span.End()

	if len(searchRes) == 0 {
		return nil, nil
	}

	orgId := query.OrgId
	if orgId == 0 && query.SignedInUser.GetOrgID() != 0 {
		orgId = query.SignedInUser.GetOrgID()
	} else {
		return nil, dashboards.ErrUserIsNotSignedInToOrg
	}

	concurrentRequests := dr.cfg.Zanzana.ConcurrentChecks
	var wg sync.WaitGroup
	res := make([]dashboards.DashboardSearchProjection, 0)
	resToCheck := make(chan dashboards.DashboardSearchProjection, concurrentRequests)
	allowedResults := make(chan dashboards.DashboardSearchProjection, len(searchRes))

	for i := 0; i < int(concurrentRequests); i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for d := range resToCheck {
				if int64(len(allowedResults)) >= remains {
					return
				}

				objectType := zanzana.TypeDashboard
				if d.IsFolder {
					objectType = zanzana.TypeFolder
				}

				req := accesscontrol.CheckRequest{
					Namespace: claims.OrgNamespaceFormatter(orgId),
					User:      query.SignedInUser.GetUID(),
					Relation:  "read",
					Object:    zanzana.NewScopedTupleEntry(objectType, d.UID, "", strconv.FormatInt(orgId, 10)),
				}

				if objectType != zanzana.TypeFolder {
					// Pass parentn folder for the correct check
					req.Parent = d.FolderUID
					req.ObjectType = objectType
				}

				allowed, err := dr.ac.Check(ctx, req)
				if err != nil {
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
		if int64(len(res)) >= remains {
			break
		}
		res = append(res, r)
	}

	return res, nil
}

// findDashboardsZanzanaList implements "List, then search" strategy. It first retrieve a list of resources
// with given type available to the user and then passes that list as a filter to the search query.
func (dr *DashboardServiceImpl) findDashboardsZanzanaList(ctx context.Context, query dashboards.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error) {
	// Always use "search, then check" if dashboard or folder UIDs provided. Otherwise we should make intersection
	// of user's resources and provided UIDs which might not be correct if ListObjects() request is limited by OpenFGA.
	if len(query.DashboardUIDs) > 0 || len(query.DashboardIds) > 0 || len(query.FolderUIDs) > 0 {
		return dr.findDashboardsZanzanaCheck(ctx, query)
	}

	ctx, span := tracer.Start(ctx, "dashboards.service.findDashboardsZanzanaList")
	defer span.End()

	var result []dashboards.DashboardSearchProjection

	allowedFolders, err := dr.listAllowedResources(ctx, query, zanzana.TypeFolder)
	if err != nil {
		return nil, err
	}

	if len(allowedFolders) > 0 {
		// Find dashboards in folders that user has access to
		query.SkipAccessControlFilter = true
		query.FolderUIDs = allowedFolders
		result, err = dr.dashboardStore.FindDashboards(ctx, &query)
		if err != nil {
			return nil, err
		}
	}

	// skip if limit reached
	rest := query.Limit - int64(len(result))
	if rest <= 0 {
		return result, nil
	}

	// Run second query to find dashboards with direct permission assignments
	allowedDashboards, err := dr.listAllowedResources(ctx, query, zanzana.TypeDashboard)
	if err != nil {
		return nil, err
	}

	if len(allowedDashboards) > 0 {
		query.FolderUIDs = []string{}
		query.DashboardUIDs = allowedDashboards
		query.Limit = rest
		dashboardRes, err := dr.dashboardStore.FindDashboards(ctx, &query)
		if err != nil {
			return nil, err
		}
		result = append(result, dashboardRes...)
	}

	return result, err
}

func (dr *DashboardServiceImpl) listAllowedResources(ctx context.Context, query dashboards.FindPersistedDashboardsQuery, resourceType string) ([]string, error) {
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
	} else {
		return nil, dashboards.ErrUserIsNotSignedInToOrg
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
