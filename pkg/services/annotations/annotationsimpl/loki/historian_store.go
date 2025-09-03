package loki

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/grafana/alerting/notify/historian/lokiclient"
	"github.com/grafana/grafana/pkg/services/ngalert/lokiconfig"
	"golang.org/x/exp/constraints"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/annotations/accesscontrol"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	ngmetrics "github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/state/historian"
	historymodel "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	subsystem         = "annotations"
	defaultQueryRange = 6 * time.Hour // from grafana/pkg/services/ngalert/state/historian/loki.go
)

var (
	ErrLokiStoreInternal = errutil.Internal("annotations.loki.internal")
	ErrLokiStoreNotFound = errutil.NotFound("annotations.loki.notFound")
)

type RuleStore interface {
	GetRuleByID(ctx context.Context, query ngmodels.GetAlertRuleByIDQuery) (result *ngmodels.AlertRule, err error)
}

type lokiQueryClient interface {
	RangeQuery(ctx context.Context, query string, start, end, limit int64) (lokiclient.QueryRes, error)
	MaxQuerySize() int
}

// LokiHistorianStore is a read store that queries Loki for alert state history.
type LokiHistorianStore struct {
	client    lokiQueryClient
	db        db.DB
	log       log.Logger
	ruleStore RuleStore
}

func NewLokiHistorianStore(cfg setting.UnifiedAlertingStateHistorySettings, db db.DB, ruleStore RuleStore, log log.Logger, tracer tracing.Tracer, reg prometheus.Registerer) *LokiHistorianStore {
	if !useStore(cfg) {
		return nil
	}
	lokiCfg, err := lokiconfig.NewLokiConfig(cfg.LokiSettings)
	if err != nil {
		// this config error is already handled elsewhere
		return nil
	}

	metrics := ngmetrics.NewHistorianMetrics(reg, subsystem)
	return &LokiHistorianStore{
		client:    lokiclient.NewLokiClient(lokiCfg, lokiclient.NewRequester(), metrics.BytesWritten, metrics.WriteDuration, log, tracer, historian.LokiClientSpanName),
		db:        db,
		log:       log,
		ruleStore: ruleStore,
	}
}

func (r *LokiHistorianStore) Type() string {
	return "loki"
}

func (r *LokiHistorianStore) Get(ctx context.Context, query annotations.ItemQuery, accessResources *accesscontrol.AccessResources) ([]*annotations.ItemDTO, error) {
	if query.Type == "annotation" {
		return make([]*annotations.ItemDTO, 0), nil
	}

	// if the query is filtering on tags, but not on a specific dashboard, we shouldn't query loki
	// since state history won't have tags for annotations
	// nolint: staticcheck
	if len(query.Tags) > 0 && query.DashboardID == 0 && query.DashboardUID == "" {
		return make([]*annotations.ItemDTO, 0), nil
	}

	var ruleUID string
	if query.AlertUID != "" {
		ruleUID = query.AlertUID
	} else if query.AlertID != 0 {
		rule, err := r.ruleStore.GetRuleByID(ctx, ngmodels.GetAlertRuleByIDQuery{OrgID: query.OrgID, ID: query.AlertID})
		if err != nil {
			if errors.Is(err, ngmodels.ErrAlertRuleNotFound) {
				return make([]*annotations.ItemDTO, 0), ErrLokiStoreNotFound.Errorf("rule with ID %d does not exist", query.AlertID)
			}
			return make([]*annotations.ItemDTO, 0), ErrLokiStoreInternal.Errorf("failed to query rule: %w", err)
		}
		ruleUID = rule.UID
	}

	// No folders in the filter because it filter by Dashboard UID, and the request is already authorized.
	logQL, err := historian.BuildLogQuery(buildHistoryQuery(&query, accessResources.Dashboards, ruleUID), nil, r.client.MaxQuerySize())
	if err != nil {
		grafanaErr := errutil.Error{}
		if errors.As(err, &grafanaErr) {
			return make([]*annotations.ItemDTO, 0), err
		}
		return make([]*annotations.ItemDTO, 0), ErrLokiStoreInternal.Errorf("failed to build loki query: %w", err)
	}
	if len(logQL) > 1 {
		r.log.FromContext(ctx).Info("Execute query in multiple batches", "batches", logQL, "maxQueryLimit", r.client.MaxQuerySize())
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
	items := make([]*annotations.ItemDTO, 0)
	for _, q := range logQL {
		res, err := r.client.RangeQuery(ctx, q, from, to, query.Limit)
		if err != nil {
			return make([]*annotations.ItemDTO, 0), ErrLokiStoreInternal.Errorf("failed to query loki: %w", err)
		}
		for _, stream := range res.Data.Result {
			items = append(items, r.annotationsFromStream(stream, *accessResources)...)
		}
	}
	sort.Sort(annotations.SortedItems(items))
	return items, err
}

func (r *LokiHistorianStore) annotationsFromStream(stream lokiclient.Stream, ac accesscontrol.AccessResources) []*annotations.ItemDTO {
	items := make([]*annotations.ItemDTO, 0, len(stream.Values))
	for _, sample := range stream.Values {
		entry := historian.LokiEntry{}
		err := json.Unmarshal([]byte(sample.V), &entry)
		if err != nil {
			// bad data, skip
			r.log.Debug("failed to unmarshal loki entry", "error", err, "entry", sample.V)
			continue
		}

		if !hasAccess(entry, ac) {
			// no access to this annotation, skip
			continue
		}

		transition, err := buildTransition(entry)
		if err != nil {
			// bad data, skip
			r.log.Debug("failed to build transition", "error", err, "entry", entry)
			continue
		}

		if !historian.ShouldRecordAnnotation(*transition) {
			// skip non-annotation transition
			continue
		}

		annotationText, annotationData := historian.BuildAnnotationTextAndData(
			historymodel.RuleMeta{
				Title: entry.RuleTitle,
			},
			transition.State,
		)

		items = append(items, &annotations.ItemDTO{
			AlertID:      entry.RuleID,
			DashboardID:  ac.Dashboards[entry.DashboardUID], // nolint: staticcheck
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

func (r *LokiHistorianStore) GetTags(ctx context.Context, query annotations.TagsQuery) (annotations.FindTagsResult, error) {
	return annotations.FindTagsResult{Tags: []*annotations.TagsDTO{}}, nil
}

// util

func hasAccess(entry historian.LokiEntry, resources accesscontrol.AccessResources) bool {
	orgFilter := resources.CanAccessOrgAnnotations && entry.DashboardUID == ""
	dashFilter := func() bool {
		if !resources.CanAccessDashAnnotations {
			return false
		}
		_, canAccess := resources.Dashboards[entry.DashboardUID]
		return canAccess
	}

	return orgFilter || dashFilter()
}

type number interface {
	constraints.Integer | constraints.Float
}

// numericMap converts a simplejson map[string]any to a map[string]N, where N is numeric (int or float).
func numericMap[N number](j *simplejson.Json) (map[string]N, error) {
	if j == nil {
		return nil, fmt.Errorf("unexpected nil value")
	}

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

func buildTransition(entry historian.LokiEntry) (*state.StateTransition, error) {
	curState, curStateReason, err := state.ParseFormattedState(entry.Current)
	if err != nil {
		return nil, fmt.Errorf("parsing current state: %w", err)
	}

	prevState, prevReason, err := state.ParseFormattedState(entry.Previous)
	if err != nil {
		return nil, fmt.Errorf("parsing previous state: %w", err)
	}

	v, err := numericMap[float64](entry.Values)
	if err != nil {
		return nil, fmt.Errorf("parsing entry values: %w", err)
	}

	return &state.StateTransition{
		State: &state.State{
			State:       curState,
			StateReason: curStateReason,
			Values:      v,
			Labels:      entry.InstanceLabels,
		},
		PreviousState:       prevState,
		PreviousStateReason: prevReason,
	}, nil
}

func buildHistoryQuery(query *annotations.ItemQuery, dashboards map[string]int64, ruleUID string) ngmodels.HistoryQuery {
	historyQuery := ngmodels.HistoryQuery{
		OrgID:        query.OrgID,
		DashboardUID: query.DashboardUID,
		PanelID:      query.PanelID,
		RuleUID:      ruleUID,
	}

	// nolint: staticcheck
	if historyQuery.DashboardUID == "" && query.DashboardID != 0 {
		for uid, id := range dashboards {
			// nolint: staticcheck
			if query.DashboardID == id {
				historyQuery.DashboardUID = uid
				break
			}
		}
	}

	return historyQuery
}

func useStore(cfg setting.UnifiedAlertingStateHistorySettings) bool {
	if !cfg.Enabled {
		return false
	}

	backend, err := historian.ParseBackendType(cfg.Backend)
	if err != nil {
		return false
	}

	// We should only query Loki if annotations do not exist in the database.
	return backend == historian.BackendTypeLoki
}
