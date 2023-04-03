package annotationsimpl

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

// CleanupServiceImpl is responsible for cleaning old annotations.
type CleanupServiceImpl struct {
	totalCleanedAnnotations       *prometheus.CounterVec
	totalCleanedAnnotationsTags   prometheus.Counter
	cleanupAnnotationsDuration    *prometheus.HistogramVec
	cleanupAnnotationTagsDuration prometheus.Histogram
	store                         store
}

func ProvideCleanupService(db db.DB, cfg *setting.Cfg, promRegisterer prometheus.Registerer) (*CleanupServiceImpl, error) {
	s := &CleanupServiceImpl{
		totalCleanedAnnotations: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: "grafana",
			Name:      "cleaned_annotations_total",
			Help:      "Number of cleaned annotations",
		}, []string{"type"}),
		totalCleanedAnnotationsTags: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: "grafana",
			Name:      "cleaned_annotations_tags_total",
			Help:      "Number of cleaned annotation tags",
		}),
		cleanupAnnotationsDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: "grafana",
			Name:      "cleanup_annotations_duration",
			Help:      "Annotation cleanup duration",
			Buckets:   prometheus.ExponentialBuckets(0.001, 4, 10),
		}, []string{"type"}),
		cleanupAnnotationTagsDuration: prometheus.NewHistogram(prometheus.HistogramOpts{
			Namespace: "grafana",
			Name:      "cleanup_annotation_tags_duration",
			Help:      "Annotation tags cleanup duration",
			Buckets:   prometheus.ExponentialBuckets(0.001, 4, 10),
		}),
		store: &xormRepositoryImpl{
			cfg: cfg,
			db:  db,
			log: log.New("annotations"),
		},
	}

	err := errors.Join(
		promRegisterer.Register(s.totalCleanedAnnotations),
		promRegisterer.Register(s.totalCleanedAnnotationsTags),
		promRegisterer.Register(s.cleanupAnnotationsDuration),
		promRegisterer.Register(s.cleanupAnnotationTagsDuration),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to register metrics: %w", err)
	}

	return s, nil
}

const (
	alertAnnotationType     = "alert_id <> 0"
	dashboardAnnotationType = "dashboard_id <> 0 AND alert_id = 0"
	apiAnnotationType       = "alert_id = 0 AND dashboard_id = 0"
)

// Run deletes old annotations created by alert rules, API
// requests and human made in the UI. It subsequently deletes orphaned rows
// from the annotation_tag table. Cleanup actions are performed in batches
// so that no query takes too long to complete.
//
// Returns the number of annotation and annotation_tag rows deleted. If an
// error occurs, it returns the number of rows affected so far.
func (cs *CleanupServiceImpl) Run(ctx context.Context, cfg *setting.Cfg) (int64, int64, error) {
	var totalCleanedAnnotations int64
	start := time.Now()
	affected, err := cs.store.CleanAnnotations(ctx, cfg.AlertingAnnotationCleanupSetting, alertAnnotationType)
	totalCleanedAnnotations += affected
	if err != nil {
		return totalCleanedAnnotations, 0, err
	}
	cs.cleanupAnnotationsDuration.WithLabelValues("alert").Observe(time.Since(start).Seconds())
	cs.totalCleanedAnnotations.WithLabelValues("alert").Add(float64(affected))

	start = time.Now()
	affected, err = cs.store.CleanAnnotations(ctx, cfg.APIAnnotationCleanupSettings, apiAnnotationType)
	totalCleanedAnnotations += affected
	if err != nil {
		return totalCleanedAnnotations, 0, err
	}
	cs.cleanupAnnotationsDuration.WithLabelValues("api").Observe(time.Since(start).Seconds())
	cs.totalCleanedAnnotations.WithLabelValues("api").Add(float64(affected))

	start = time.Now()
	affected, err = cs.store.CleanAnnotations(ctx, cfg.DashboardAnnotationCleanupSettings, dashboardAnnotationType)
	totalCleanedAnnotations += affected
	if err != nil {
		return totalCleanedAnnotations, 0, err
	}
	cs.cleanupAnnotationsDuration.WithLabelValues("dashboard").Observe(time.Since(start).Seconds())
	cs.totalCleanedAnnotations.WithLabelValues("dashboard").Add(float64(affected))

	if totalCleanedAnnotations > 0 {
		start = time.Now()
		affected, err = cs.store.CleanOrphanedAnnotationTags(ctx)
		cs.cleanupAnnotationTagsDuration.Observe(time.Since(start).Seconds())
		cs.totalCleanedAnnotationsTags.Add(float64(affected))
	}

	return totalCleanedAnnotations, affected, err
}
