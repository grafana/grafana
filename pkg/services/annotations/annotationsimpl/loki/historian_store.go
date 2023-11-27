package loki

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/annotations/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert"
	ngmetrics "github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/state/historian"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

const (
	subsystem = "annotations"
)

type lokiQueryClient interface {
	RangeQuery(ctx context.Context, query string, start, end, limit int64) (historian.QueryRes, error)
}

type LokiHistorianStore struct {
	client lokiQueryClient
	db     db.DB
	log    log.Logger
}

func NewLokiHistorianStore(cfg setting.UnifiedAlertingStateHistorySettings, ft featuremgmt.FeatureToggles, db db.DB, log log.Logger) *LokiHistorianStore {
	if !useStore(cfg, ft) && false { // TODO: no-op until this is implemented
		return nil
	}
	lokiCfg, err := historian.NewLokiConfig(cfg)
	if err != nil {
		// this config error is already handled elsewhere
		return nil
	}

	return &LokiHistorianStore{
		client: historian.NewLokiClient(lokiCfg, historian.NewRequester(), ngmetrics.NewHistorianMetrics(prometheus.DefaultRegisterer, subsystem), log),
		db:     db,
		log:    log,
	}
}

func (r *LokiHistorianStore) Add(ctx context.Context, items *annotations.Item) error {
	return annotations.ErrStoreMethodNotImplemented
}

func (r *LokiHistorianStore) AddMany(ctx context.Context, items []annotations.Item) error {
	return annotations.ErrStoreMethodNotImplemented
}

func (r *LokiHistorianStore) Update(ctx context.Context, item *annotations.Item) error {
	return annotations.ErrStoreMethodNotImplemented
}

func (r *LokiHistorianStore) Get(ctx context.Context, query *annotations.ItemQuery, accessResources *accesscontrol.AccessResources) ([]*annotations.ItemDTO, error) {
	return nil, annotations.ErrStoreMethodNotImplemented
}

func (r *LokiHistorianStore) Delete(ctx context.Context, params *annotations.DeleteParams) error {
	return annotations.ErrStoreMethodNotImplemented
}

func (r *LokiHistorianStore) GetTags(ctx context.Context, query *annotations.TagsQuery) (annotations.FindTagsResult, error) {
	return annotations.FindTagsResult{}, annotations.ErrStoreMethodNotImplemented
}

func (r *LokiHistorianStore) CleanAnnotations(ctx context.Context, cfg setting.AnnotationCleanupSettings, annotationType string) (int64, error) {
	return 0, annotations.ErrStoreMethodNotImplemented
}

func (r *LokiHistorianStore) CleanOrphanedAnnotationTags(ctx context.Context) (int64, error) {
	return 0, annotations.ErrStoreMethodNotImplemented
}

func useStore(cfg setting.UnifiedAlertingStateHistorySettings, ft featuremgmt.FeatureToggles) bool {
	if !cfg.Enabled {
		return false
	}

	// Override config based on feature toggles.
	// We pass in a no-op logger here since this function is also called during ngalert init,
	// and we don't want to log the same problem twice.
	ngalert.ApplyStateHistoryFeatureToggles(&cfg, ft, log.NewNopLogger())

	backend, err := historian.ParseBackendType(cfg.Backend)
	if err != nil {
		return false
	}

	switch backend {
	case historian.BackendTypeLoki:
		return true
	case historian.BackendTypeMultiple:
		pCfg := cfg
		pCfg.Backend = cfg.MultiPrimary
		p, err := historian.ParseBackendType(pCfg.Backend)
		if err != nil {
			return false
		}
		if p == historian.BackendTypeLoki {
			return true
		}

		secondaries := make([]historian.BackendType, 0)
		for _, b := range cfg.MultiSecondaries {
			sCfg := cfg
			sCfg.Backend = b
			s, err := historian.ParseBackendType(sCfg.Backend)
			if err != nil {
				return false
			}
			secondaries = append(secondaries, s)
		}

		for _, b := range secondaries {
			if b == historian.BackendTypeLoki {
				return true
			}
		}
	default:
		return false
	}

	return false
}
