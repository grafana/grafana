package metric

import (
	"context"
	"errors"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/prometheus/client_golang/prometheus"
	"strconv"
	"time"
)

type PublicDashboardsMetricServiceImpl struct {
	store   publicdashboards.Store
	Metrics *Metrics
	log     log.Logger
}

func ProvideService(
	store publicdashboards.Store,
) (*PublicDashboardsMetricServiceImpl, error) {
	s := &PublicDashboardsMetricServiceImpl{
		store:   store,
		Metrics: NewMetrics(),
		log:     log.New("publicdashboards.metric"),
	}

	if err := s.registerMetrics(); err != nil {
		return nil, err
	}

	return s, nil
}

func (s *PublicDashboardsMetricServiceImpl) registerMetrics() error {
	err := prometheus.Register(s.Metrics.PublicDashboardsTotal)
	var alreadyRegisterErr prometheus.AlreadyRegisteredError
	if errors.As(err, &alreadyRegisterErr) {
		if alreadyRegisterErr.ExistingCollector == alreadyRegisterErr.NewCollector {
			err = nil
		}
	}

	return err
}

func (s *PublicDashboardsMetricServiceImpl) Run(ctx context.Context) error {
	ticker := time.Tick(12 * time.Hour)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker:
			records, err := s.store.GetMetrics(ctx)
			if err != nil {
				s.log.Error("error collecting background metrics", "err", err)
				return nil
			}

			s.Metrics.PublicDashboardsTotal.Reset()
			for _, r := range records.TotalPublicDashboards {
				s.Metrics.PublicDashboardsTotal.WithLabelValues(strconv.FormatBool(r.IsEnabled), r.ShareType).Set(r.TotalCount)
			}
		}
	}
}
