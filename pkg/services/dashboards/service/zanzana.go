package service

import (
	"context"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

const (
	defaultQueryLimit = 1000
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
	return dr.findDashboardsZanzanaCheck(ctx, query)
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

				// FIXME: support different access levels
				kind := zanzana.KindDashboards
				action := dashboards.ActionDashboardsRead
				if d.IsFolder {
					kind = zanzana.KindFolders
					action = dashboards.ActionFoldersRead
				}

				namespace := query.SignedInUser.GetNamespace()
				req, ok := zanzana.TranslateToCheckRequest(namespace, action, kind, d.FolderUID, d.UID)
				if !ok {
					continue
				}

				res, err := dr.zclient.Check(ctx, query.SignedInUser, *req)
				if err != nil {
					dr.log.Error("error checking access", "error", err)
				} else if res.Allowed {
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
