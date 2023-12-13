package loki

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/annotations/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert"
	"golang.org/x/exp/constraints"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	ngmetrics "github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/state/historian"
	historymodel "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
)

const (
	subsystem         = "annotations"
	defaultQueryRange = 6 * time.Hour // from grafana/pkg/services/ngalert/state/historian/loki.go
)

var (
	ErrLokiStoreInternal     = errutil.NewBase(errutil.StatusInternal, "annotations.loki.internal")
	ErrLokiStoreInvalidQuery = errutil.NewBase(errutil.StatusBadRequest, "annotations.loki.query")

	ErrMissingRule = errors.New("rule not found")
)

type lokiQueryClient interface {
	RangeQuery(ctx context.Context, query string, from, to, limit int64) (historian.QueryRes, error)
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
	rule := &ngmodels.AlertRule{}
	if query.AlertID != 0 {
		var err error
		rule, err = getRule(ctx, r.db, query.OrgID, query.AlertID)
		if err != nil {
			if errors.Is(err, ErrMissingRule) {
				return make([]*annotations.ItemDTO, 0), ErrLokiStoreInvalidQuery.Errorf("rule with ID %d does not exist", query.AlertID)
			}
			return make([]*annotations.ItemDTO, 0), ErrLokiStoreInternal.Errorf("failed to query rule: %w", err)
		}
	}

	logQL, err := historian.BuildLogQuery(buildHistoryQuery(ctx, query, accessResources.Dashboards, rule.UID))
	if err != nil {
		return make([]*annotations.ItemDTO, 0), ErrLokiStoreInternal.Errorf("failed to build loki query: %w", err)
	}

	now := time.Now().UTC()
	if query.To == 0 {
		query.To = now.UnixMilli()
	}
	if query.From == 0 {
		query.From = now.Add(-defaultQueryRange).UnixMilli()
	}

	// query.From and query.To are always in milliseconds, convert them to nanoseconds for loki
	from := query.From * 1e6
	to := query.To * 1e6

	res, err := r.client.RangeQuery(ctx, logQL, from, to, query.Limit)
	if err != nil {
		return make([]*annotations.ItemDTO, 0), ErrLokiStoreInternal.Errorf("failed to query loki: %w", err)
	}

	items := make([]*annotations.ItemDTO, 0)
	for _, stream := range res.Data.Result {
		items = append(items, r.annotationsFromStream(ctx, stream, query.OrgID, *accessResources)...)
	}

	// order by time desc
	sort.Slice(items, func(i, j int) bool {
		return items[i].Time > items[j].Time
	})

	return items, err
}

func (r *LokiHistorianStore) annotationsFromStream(ctx context.Context, stream historian.Stream, orgID int64, ac accesscontrol.AccessResources) []*annotations.ItemDTO {
	items := make([]*annotations.ItemDTO, 0, len(stream.Values))
	for _, sample := range stream.Values {
		entry := historian.LokiEntry{}
		err := json.Unmarshal([]byte(sample.V), &entry)
		if err != nil {
			// bad data, skip
			continue
		}

		if !hasAccess(entry, ac) {
			// no access to this annotation, skip
			continue
		}

		currentState, err := buildState(entry)
		if err != nil {
			// bad data, skip
			continue
		}

		annotationText, annotationData := historian.BuildAnnotationTextAndData(
			historymodel.RuleMeta{
				Title: entry.RuleTitle,
			},
			currentState,
		)

		items = append(items, &annotations.ItemDTO{
			AlertID:      entry.RuleID,
			DashboardID:  ac.Dashboards[entry.DashboardUID],
			DashboardUID: &entry.DashboardUID,
			PanelID:      entry.PanelID,
			NewState:     entry.Current,
			PrevState:    entry.Previous,
			Time:         sample.T.UnixMilli(),
			Text:         annotationText,
			Data:         annotationData,
		})
	}

	return items
}

func (r *LokiHistorianStore) GetTags(ctx context.Context, query *annotations.TagsQuery) (annotations.FindTagsResult, error) {
	return annotations.FindTagsResult{}, nil
}

// util

func getRule(ctx context.Context, sql db.DB, orgID int64, ruleID int64) (*ngmodels.AlertRule, error) {
	rule := &ngmodels.AlertRule{OrgID: orgID, ID: ruleID}
	err := sql.WithDbSession(ctx, func(sess *db.Session) error {
		exists, err := sess.Get(rule)
		if err != nil {
			return err
		}
		if !exists {
			return ErrMissingRule
		}
		return nil
	})

	return rule, err
}

func hasAccess(entry historian.LokiEntry, resources accesscontrol.AccessResources) bool {
	if resources.CanAccessOrgAnnotations && entry.DashboardUID == "" {
		return false
	}

	if resources.CanAccessDashAnnotations {
		_, canAccess := resources.Dashboards[entry.DashboardUID]
		if !canAccess {
			return false
		}
	}

	return true
}

type number interface {
	constraints.Integer | constraints.Float
}

// numericMap converts a simplejson map[string]any to a map[string]N, where N is numeric (int or float).
func numericMap[N number](j *simplejson.Json) (map[string]N, error) {
	m, err := j.Map()
	if err != nil {
		return nil, err
	}

	values := make(map[string]N)
	for k, v := range m {
		a, ok := (v).(json.Number)
		if !ok {
			return nil, fmt.Errorf("unexpected value type %T", v)
		}

		f, err := a.Float64()
		if err != nil {
			return nil, err
		}

		values[k] = N(f)
	}

	return values, nil
}

func buildState(entry historian.LokiEntry) (*state.State, error) {
	curState, curStateReason, err := state.ParseFormattedState(entry.Current)
	if err != nil {
		return nil, fmt.Errorf("parsing state: %w", err)
	}

	v, err := numericMap[float64](entry.Values)
	if err != nil {
		return nil, fmt.Errorf("parsing entry values: %w", err)
	}

	state := &state.State{
		State:       curState,
		StateReason: curStateReason,
		Values:      v,
		Labels:      entry.InstanceLabels,
	}
	if entry.Error != "" {
		state.Error = errors.New(entry.Error)
	}

	return state, nil
}

func buildHistoryQuery(ctx context.Context, query *annotations.ItemQuery, dashboards map[string]int64, ruleUID string) ngmodels.HistoryQuery {
	historyQuery := ngmodels.HistoryQuery{
		OrgID:        query.OrgID,
		DashboardUID: query.DashboardUID,
		PanelID:      query.PanelID,
		RuleUID:      ruleUID,
	}

	if historyQuery.DashboardUID == "" && query.DashboardID == 0 {
		for uid, id := range dashboards {
			if query.DashboardID == id {
				historyQuery.DashboardUID = uid
				break
			}
		}
	}

	return historyQuery
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
