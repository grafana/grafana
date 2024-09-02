package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

type searchResult struct {
	runner   string
	result   []dashboards.DashboardSearchProjection
	err      error
	duration time.Duration
}

func (dr *DashboardServiceImpl) FindDashboardsZanzanaCompare(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error) {
	result := make(chan searchResult, 2)

	go func() {
		timer := prometheus.NewTimer(dr.metrics.searchRequestsDuration.WithLabelValues("zanzana"))
		start := time.Now()
		defer timer.ObserveDuration()

		queryZanzana := *query
		res, err := dr.FindDashboardsZanzana(ctx, &queryZanzana)
		result <- searchResult{"zanzana", res, err, time.Since(start)}
	}()

	go func() {
		timer := prometheus.NewTimer(dr.metrics.searchRequestsDuration.WithLabelValues("grafana"))
		start := time.Now()
		defer timer.ObserveDuration()

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

func (dr *DashboardServiceImpl) FindDashboardsZanzana(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error) {
	ctx, span := tracer.Start(ctx, "dashboards.service.FindDashboardsZanzana")
	defer span.End()

	res, err := dr.acService.ListObjects(ctx, &openfgav1.ListObjectsRequest{
		User:     query.SignedInUser.GetUID(),
		Type:     zanzana.TypeDashboard,
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
	prefix := fmt.Sprintf("%s:%d-", zanzana.TypeDashboard, orgId)

	dashboardUIDs := make([]string, 0)
	for _, d := range res.Objects {
		if uid, found := strings.CutPrefix(d, prefix); found {
			dashboardUIDs = append(dashboardUIDs, uid)
		}
	}

	query.DashboardUIDs = append(dashboardUIDs, query.DashboardUIDs...)
	query.SkipAccessControlFilter = true
	return dr.dashboardStore.FindDashboards(ctx, query)
}
