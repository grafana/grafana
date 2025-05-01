package store

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
)

type AnnotationService interface {
	Find(ctx context.Context, query *annotations.ItemQuery) ([]*annotations.ItemDTO, error)
	SaveMany(ctx context.Context, items []annotations.Item) error
}

type AnnotationServiceStore struct {
	svc        AnnotationService
	dashboards *dashboardResolver
	metrics    *metrics.Historian
}

func NewAnnotationStore(svc AnnotationService, dashboards dashboards.DashboardService, metrics *metrics.Historian) *AnnotationServiceStore {
	return &AnnotationServiceStore{
		svc:        svc,
		dashboards: newDashboardResolver(dashboards, defaultDashboardCacheExpiry),
		metrics:    metrics,
	}
}

func (s *AnnotationServiceStore) Save(ctx context.Context, panel *model.PanelKey, annotations []annotations.Item, orgID int64, logger log.Logger) error {
	if panel != nil {
		dashID, err := s.dashboards.getID(ctx, panel.OrgID(), panel.DashUID())
		if err != nil {
			logger.Error("Error getting dashboard for alert annotation", "dashboardUID", panel.DashUID(), "error", err)
			dashID = 0
		}

		for i := range annotations {
			annotations[i].DashboardID = dashID
			annotations[i].PanelID = panel.PanelID()
		}
	}

	org := fmt.Sprint(orgID)
	s.metrics.WritesTotal.WithLabelValues(org, "annotations").Inc()
	s.metrics.TransitionsTotal.WithLabelValues(org).Add(float64(len(annotations)))
	if err := s.svc.SaveMany(ctx, annotations); err != nil {
		s.metrics.WritesFailed.WithLabelValues(org, "annotations").Inc()
		s.metrics.TransitionsFailed.WithLabelValues(org).Add(float64(len(annotations)))
		return fmt.Errorf("error saving alert annotation batch: %w", err)
	}
	return nil
}

func (s *AnnotationServiceStore) Find(ctx context.Context, query *annotations.ItemQuery) ([]*annotations.ItemDTO, error) {
	return s.svc.Find(ctx, query)
}
