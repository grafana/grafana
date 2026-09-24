package annotationsimpl

import (
	"context"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	alertAnnotationType     = "alert_id <> 0"
	dashboardAnnotationType = "dashboard_id <> 0 AND alert_id = 0"
	apiAnnotationType       = "alert_id = 0 AND dashboard_id = 0"
)

// defaultRetentionKVNamespace/Key identify the boot-time marker that records
// whether this instance had zero legacy-sql annotations the first time it was
// ever checked. This determines whether the 395-day default retention is applied.
const (
	defaultRetentionKVNamespace = "annotations"
	defaultRetentionKVKey       = "default_retention_resolved"

	defaultRetentionMaxAge = 395 * 24 * time.Hour
)

const (
	defaultRetentionFresh    = "fresh"
	defaultRetentionNotFresh = "not-fresh"
)

type CleanupServiceImpl struct {
	store    Store
	kv       *kvstore.NamespacedKVStore
	features featuremgmt.FeatureToggles
	log      log.Logger

	resolveFreshOnce sync.Once
	fresh            bool
}

func ProvideCleanupService(db db.DB, cfg *setting.Cfg, kv kvstore.KVStore, features featuremgmt.FeatureToggles) *CleanupServiceImpl {
	return &CleanupServiceImpl{
		store:    NewXormStore(cfg, log.New("annotations"), db, nil, nil),
		kv:       kvstore.WithNamespace(kv, 0, defaultRetentionKVNamespace),
		features: features,
		log:      log.New("annotations.cleanup"),
	}
}

// Run deletes old annotations created by alert rules, API
// requests and human made in the UI. It subsequently deletes orphaned rows
// from the annotation_tag table. Cleanup actions are performed in batches
// so that no query takes too long to complete.
//
// Returns the number of annotation and annotation_tag rows deleted. If an
// error occurs, it returns the number of rows affected so far.
func (cs *CleanupServiceImpl) Run(ctx context.Context, settings annotations.CleanupSettings) (int64, int64, error) {
	cs.applyDefaultRetention(ctx, &settings)

	var totalCleanedAnnotations int64
	affected, err := cs.store.CleanAnnotations(ctx, settings.Alerting, alertAnnotationType)
	totalCleanedAnnotations += affected
	if err != nil {
		return totalCleanedAnnotations, 0, err
	}

	affected, err = cs.store.CleanAnnotations(ctx, settings.API, apiAnnotationType)
	totalCleanedAnnotations += affected
	if err != nil {
		return totalCleanedAnnotations, 0, err
	}

	affected, err = cs.store.CleanAnnotations(ctx, settings.Dashboard, dashboardAnnotationType)
	totalCleanedAnnotations += affected
	if err != nil {
		return totalCleanedAnnotations, 0, err
	}
	if totalCleanedAnnotations > 0 {
		affected, err = cs.store.CleanOrphanedAnnotationTags(ctx)
	}
	return totalCleanedAnnotations, affected, err
}

// applyDefaultRetention fills in the 395-day default MaxAge for any of the
// three categories where the operator hasn't explicitly set max_age, but only
// on instances resolved as "fresh" (zero annotations at first boot). Explicit
// config always wins, and this never applies to instances that already have
// annotations, so no existing history is ever silently pruned.
func (cs *CleanupServiceImpl) applyDefaultRetention(ctx context.Context, settings *annotations.CleanupSettings) {
	if !cs.features.IsEnabled(ctx, featuremgmt.FlagAnnotationDefaultRetention) {
		return
	}

	fresh, err := cs.resolveFresh(ctx)
	if err != nil {
		cs.log.Error("Failed to resolve default annotation retention state", "error", err)
		return
	}
	if !fresh {
		return
	}

	applyDefault := func(s *setting.AnnotationCleanupSettings) {
		if !s.MaxAgeSet {
			s.MaxAge = defaultRetentionMaxAge
		}
	}
	applyDefault(&settings.Alerting)
	applyDefault(&settings.API)
	applyDefault(&settings.Dashboard)
}

// resolveFresh returns whether this instance was empty of annotations the
// first time it was ever checked, persisting the answer via kvstore on first
// resolution so it is never re-derived on subsequent boots.
func (cs *CleanupServiceImpl) resolveFresh(ctx context.Context) (bool, error) {
	var resolveErr error
	cs.resolveFreshOnce.Do(func() {
		value, ok, err := cs.kv.Get(ctx, defaultRetentionKVKey)
		if err != nil {
			resolveErr = err
			return
		}
		if ok {
			cs.fresh = value == defaultRetentionFresh
			return
		}

		anyExist, err := cs.store.AnyAnnotationsExist(ctx)
		if err != nil {
			resolveErr = err
			return
		}

		cs.fresh = !anyExist
		marker := defaultRetentionNotFresh
		if cs.fresh {
			marker = defaultRetentionFresh
		}
		if err := cs.kv.Set(ctx, defaultRetentionKVKey, marker); err != nil {
			resolveErr = err
			return
		}
	})
	if resolveErr != nil {
		// Allow retrying on a later call instead of caching a failed resolution.
		cs.resolveFreshOnce = sync.Once{}
		return false, resolveErr
	}
	return cs.fresh, nil
}
