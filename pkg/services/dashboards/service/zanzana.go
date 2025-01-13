package service

import (
	"context"
	"errors"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/dashboards"
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

type checkDashboardsFn func(context.Context, dashboards.FindPersistedDashboardsQuery, []dashboards.DashboardSearchProjection, int64) ([]dashboards.DashboardSearchProjection, error)

func (dr *DashboardServiceImpl) findDashboardsZanzana(ctx context.Context, query dashboards.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error) {
	if len(query.Title) <= listQueryLengthThreshold || query.Limit > listQueryLimitThreshold {
		checkCompileFn, err := dr.getCheckCompileFn(ctx, query)
		if err != nil {
			return nil, err
		}
		return dr.findDashboardsZanzanaGeneric(ctx, query, checkCompileFn)
	}

	return dr.findDashboardsZanzanaGeneric(ctx, query, dr.checkDashboardsBatch)
}

// findDashboardsZanzanaGeneric runs search query in the database and then check if resultls
// available to user by calling provided checkFn function. It could be check-based or compile (list) - based.
func (dr *DashboardServiceImpl) findDashboardsZanzanaGeneric(ctx context.Context, query dashboards.FindPersistedDashboardsQuery, checkFn checkDashboardsFn) ([]dashboards.DashboardSearchProjection, error) {
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
		findRes, err := dr.FindDashboards(ctx, &query)
		if err != nil {
			return nil, err
		}

		remains := limit - int64(len(result))
		res, err := checkFn(ctx, query, findRes, remains)
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

func (dr *DashboardServiceImpl) getCheckCompileFn(ctx context.Context, query dashboards.FindPersistedDashboardsQuery) (checkDashboardsFn, error) {
	// List available folders
	namespace := query.SignedInUser.GetNamespace()
	req, ok := zanzana.TranslateToListRequest(namespace, dashboards.ActionFoldersRead, zanzana.KindFolders)
	if !ok {
		return nil, errors.New("resource type not supported")
	}
	folderChecker, err := dr.zclient.Compile(ctx, query.SignedInUser, *req)
	if err != nil {
		return nil, err
	}

	// List available dashboards
	req, ok = zanzana.TranslateToListRequest(namespace, dashboards.ActionDashboardsRead, zanzana.KindDashboards)
	if !ok {
		return nil, errors.New("resource type not supported")
	}
	dashboardChecker, err := dr.zclient.Compile(ctx, query.SignedInUser, *req)
	if err != nil {
		return nil, err
	}

	return func(_ context.Context, _ dashboards.FindPersistedDashboardsQuery, searchRes []dashboards.DashboardSearchProjection, remains int64) ([]dashboards.DashboardSearchProjection, error) {
		result := make([]dashboards.DashboardSearchProjection, 0)
		for _, d := range searchRes {
			if len(result) >= int(remains) {
				break
			}
			allowed := false
			if d.IsFolder {
				allowed = folderChecker(namespace, d.UID, d.FolderUID)
			} else {
				allowed = dashboardChecker(namespace, d.UID, d.FolderUID)
			}
			if allowed {
				result = append(result, d)
			}
		}

		return result, nil
	}, nil
}
