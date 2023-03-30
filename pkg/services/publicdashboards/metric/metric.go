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

var LogPrefix = "publicdashboards.metric"

func ProvideService(
	store publicdashboards.Store,
) (*PublicDashboardsMetricServiceImpl, error) {
	s := &PublicDashboardsMetricServiceImpl{
		store:   store,
		Metrics: NewMetrics(),
		log:     log.New(LogPrefix),
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
	//TODO change this. Every 24hs?
	ticker := time.Tick(10 * time.Second)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker:
			records, err := s.store.GetMetrics(ctx)
			if err != nil {
				s.log.Debug("error collecting background metrics", "error", err)
				//TODO check if it finishes the Run
				return err
			}

			s.Metrics.PublicDashboardsTotal.Reset()
			for _, r := range records.TotalPublicDashboards {
				s.Metrics.PublicDashboardsTotal.WithLabelValues(strconv.FormatBool(r.IsEnabled), r.ShareType).Set(r.TotalCount)
			}
		}
	}
}
