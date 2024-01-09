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

// LokiHistorianStore is a read store that queries Loki for alert state history.
type LokiHistorianStore struct {
	client lokiQueryClient
	db     db.DB
	log    log.Logger
}

func NewLokiHistorianStore(cfg setting.UnifiedAlertingStateHistorySettings, ft featuremgmt.FeatureToggles, db db.DB, log log.Logger) *LokiHistorianStore {
	if !useStore(cfg, ft) {
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

func (r *LokiHistorianStore) Get(ctx context.Context, query *annotations.ItemQuery, accessResources *accesscontrol.AccessResources) ([]*annotations.ItemDTO, error) {
	return []*annotations.ItemDTO{}, nil
}

func (r *LokiHistorianStore) GetTags(ctx context.Context, query *annotations.TagsQuery) (annotations.FindTagsResult, error) {
	return annotations.FindTagsResult{}, nil
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

	// We should only query Loki if annotations do no exist in the database.
	return backend == historian.BackendTypeLoki
}
