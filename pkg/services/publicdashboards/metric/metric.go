package metric

import (
	"context"
	"fmt"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/prometheus/client_golang/prometheus"
	"strconv"
	"time"
)

type PublicDashboardsMetricServiceImpl struct {
	store   publicdashboards.Store
	Metrics *Metrics
}

func ProvideService(
	store publicdashboards.Store,
	prom prometheus.Registerer,
) (*PublicDashboardsMetricServiceImpl, error) {
	s := &PublicDashboardsMetricServiceImpl{
		store:   store,
		Metrics: NewMetrics(),
	}

	err := prom.Register(s.Metrics.PublicDashboardsTotal)
	if err != nil {
		return nil, fmt.Errorf("failed to register metrics: %w", err)
	}

	return s, nil
}

func (s *PublicDashboardsMetricServiceImpl) Run(ctx context.Context) error {
	ticker := time.Tick(10 * time.Second)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker:
			records, _ := s.store.GetMetrics(ctx)

			s.Metrics.PublicDashboardsTotal.Reset()
			for _, r := range records.TotalPublicDashboards {
				s.Metrics.PublicDashboardsTotal.WithLabelValues(strconv.FormatBool(r.IsEnabled), r.ShareType).Set(r.TotalCount)
			}
		}
	}
}
