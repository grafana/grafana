package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
)

const (
	defaultQueryLimit = 1000
	// If search query string shorter than this value, then "List, then check" strategy will be used
	listQueryLengthThreshold = 8
	// If query limit set to value higher than this value, then "List, then check" strategy will be used
	listQueryLimitThreshold = 50
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
	if len(query.Title) <= listQueryLengthThreshold || query.Limit > listQueryLimitThreshold {
		return dr.findDashboardsZanzanaList(ctx, query)
	}

	return dr.findDashboardsZanzanaCheck(ctx, query)
}

// findDashboardsZanzanaCheck implements "Search, then check" strategy. It first performs search query, then filters out results
// by checking access to each item.
func (dr *DashboardServiceImpl) findDashboardsZanzanaCheck(ctx context.Context, query dashboards.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.findDashboardsZanzanaCheck")
	defer span.End()

	result := make([]dashboards.DashboardSearchProjection, 0, query.Limit)

	query.SkipAccessControlFilter = true
	// Remember initial query limit
	limit := query.Limit
	// Set limit to default to prevent pagination issues
	query.Limit = defaultQueryLimit
	if query.Page == 0 {
		query.Page = 1
	}

	for len(result) < int(limit) {
		findRes, err := dr.dashboardStore.FindDashboards(ctx, &query)
		if err != nil {
			return nil, err
		}

		remains := limit - int64(len(result))
		res, err := dr.checkDashboardsBatch(ctx, query, findRes, remains)
		if err != nil {
			return nil, err
		}

		result = append(result, res...)
		query.Page++

		// Stop when last page reached
		if len(findRes) < defaultQueryLimit {
			break
		}
	}

	return result, nil
}

func (dr *DashboardServiceImpl) checkDashboardsBatch(ctx context.Context, query dashboards.FindPersistedDashboardsQuery, searchRes []dashboards.DashboardSearchProjection, remains int64) ([]dashboards.DashboardSearchProjection, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.checkDashboardsBatch")
	defer span.End()

	if len(searchRes) == 0 {
		return nil, nil
	}

	batchReqItems := make([]*authzextv1.BatchCheckItem, 0, len(searchRes))

	for _, d := range searchRes {
		// FIXME: support different access levels
		kind := zanzana.KindDashboards
		action := dashboards.ActionDashboardsRead
		if d.IsFolder {
			kind = zanzana.KindFolders
			action = dashboards.ActionFoldersRead
		}

		checkReq, ok := zanzana.TranslateToCheckRequest("", action, kind, d.FolderUID, d.UID)
		if !ok {
			continue
		}

		batchReqItems = append(batchReqItems, &authzextv1.BatchCheckItem{
			Verb:        checkReq.Verb,
			Group:       checkReq.Group,
			Resource:    checkReq.Resource,
			Name:        checkReq.Name,
			Folder:      checkReq.Folder,
			Subresource: checkReq.Subresource,
		})
	}

	batchReq := authzextv1.BatchCheckRequest{
		Namespace: query.SignedInUser.GetNamespace(),
		Subject:   query.SignedInUser.GetUID(),
		Items:     batchReqItems,
	}

	res, err := dr.zclient.BatchCheck(ctx, &batchReq)
	if err != nil {
		return nil, err
	}

	result := make([]dashboards.DashboardSearchProjection, 0)
	for _, d := range searchRes {
		if len(result) >= int(remains) {
			break
		}

		kind := zanzana.KindDashboards
		if d.IsFolder {
			kind = zanzana.KindFolders
		}
		groupResource := zanzana.TranslateToGroupResource(kind)
		if group, ok := res.Groups[groupResource]; ok {
			if allowed := group.Items[d.UID]; allowed {
				result = append(result, d)
			}
		}
	}

	return result, nil
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

	if query.Type == searchstore.TypeFolder || query.Type == searchstore.TypeAlertFolder {
		return dr.findFoldersZanzanaList(ctx, query)
	}

	// List folders where user can read dashboards
	allowedFolders, err := dr.listAllowedResources(ctx, query, zanzana.KindFolders, dashboards.ActionDashboardsRead)
	if err != nil {
		return nil, err
	}

	var result []dashboards.DashboardSearchProjection

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
	allowedDashboards, err := dr.listAllowedResources(ctx, query, zanzana.KindDashboards, dashboards.ActionDashboardsRead)
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

// findFoldersZanzanaList searches for folders available to users.
func (dr *DashboardServiceImpl) findFoldersZanzanaList(ctx context.Context, query dashboards.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error) {
	action := dashboards.ActionFoldersRead
	if query.Type == searchstore.TypeAlertFolder {
		action = accesscontrol.ActionAlertingRuleRead
	}

	// List available folders
	allowedFolders, err := dr.listAllowedResources(ctx, query, zanzana.KindFolders, action)
	if err != nil {
		return nil, err
	}

	if len(allowedFolders) == 0 {
		return []dashboards.DashboardSearchProjection{}, nil
	}

	query.DashboardUIDs = allowedFolders
	return dr.dashboardStore.FindDashboards(ctx, &query)
}

func (dr *DashboardServiceImpl) listAllowedResources(ctx context.Context, query dashboards.FindPersistedDashboardsQuery, kind, action string) ([]string, error) {
	ns := query.SignedInUser.GetNamespace()
	req, ok := zanzana.TranslateToListRequest(ns, action, kind)
	if !ok {
		return nil, errors.New("resource type not supported")
	}

	res, err := dr.zclient.List(ctx, query.SignedInUser, req)
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
	prefix := fmt.Sprintf("%s:%d-", kind, orgId)

	resourceUIDs := make([]string, 0)
	for _, d := range res.Items {
		if uid, found := strings.CutPrefix(d, prefix); found {
			resourceUIDs = append(resourceUIDs, uid)
		}
	}

	return resourceUIDs, nil
}
