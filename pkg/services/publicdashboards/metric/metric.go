package metric

import (
	"context"
	"errors"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/prometheus/client_golang/prometheus"
)

type Service struct {
	store   publicdashboards.Store
	Metrics *Metrics
	log     log.Logger
}

func ProvideService(
	store publicdashboards.Store,
	prom prometheus.Registerer,
) (*Service, error) {
	s := &Service{
		store:   store,
		Metrics: newMetrics(),
		log:     log.New("publicdashboards.metric"),
	}

	if err := s.registerMetrics(prom); err != nil {
		return nil, err
	}

	return s, nil
}

func (s *Service) registerMetrics(prom prometheus.Registerer) error {
	err := prom.Register(s.Metrics.PublicDashboardsAmount)
	var alreadyRegisterErr prometheus.AlreadyRegisteredError
	if errors.As(err, &alreadyRegisterErr) {
		if alreadyRegisterErr.ExistingCollector == alreadyRegisterErr.NewCollector {
			err = nil
		}
	}

	return err
}

func (s *Service) Run(ctx context.Context) error {
	s.recordMetrics(ctx)

	ticker := time.NewTicker(12 * time.Hour)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			s.recordMetrics(ctx)
		}
	}
}

func (s *Service) recordMetrics(ctx context.Context) {
	records, err := s.store.GetMetrics(ctx)
	if err != nil {
		s.log.Error("error collecting background metrics", "err", err)
		return
	}

	s.Metrics.PublicDashboardsAmount.Reset()
	for _, r := range records.TotalPublicDashboards {
		s.Metrics.PublicDashboardsAmount.WithLabelValues(strconv.FormatBool(r.IsEnabled), r.ShareType).Set(r.TotalCount)
	}
}
