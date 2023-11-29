package loki

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/annotations/accesscontrol"

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

type LokiHistorianStore struct {
	client lokiQueryClient
	db     db.DB
	log    log.Logger
}

func NewLokiHistorianStore(cfg setting.UnifiedAlertingStateHistorySettings, db db.DB, log log.Logger) *LokiHistorianStore {
	lokiCfg, err := historian.NewLokiConfig(cfg)
	if err != nil {
		// this config error is already handled elsewhere
		return nil
	}
	req := historian.NewRequester()
	met := ngmetrics.NewHistorianMetrics(prometheus.DefaultRegisterer, subsystem)

	return &LokiHistorianStore{
		client: historian.NewLokiClient(lokiCfg, req, met, log),
		db:     db,
		log:    log,
	}
}

func (r *LokiHistorianStore) Get(ctx context.Context, query *annotations.ItemQuery, accessResources accesscontrol.AccessResources) ([]*annotations.ItemDTO, error) {
	ruleCache := newRuleCache(r.db)

	historyQuery, err := buildHistoryQuery(ctx, query, accessResources.Dashboards, ruleCache)
	if err != nil {
		if errors.Is(err, ErrMissingRule) {
			return []*annotations.ItemDTO{}, ErrLokiStoreInvalidQuery.Errorf("rule with ID %d does not exist", query.AlertID)
		}
		return []*annotations.ItemDTO{}, ErrLokiStoreInternal.Errorf("failed to build historian query: %w", err)
	}

	logQL, err := historian.BuildLogQuery(historyQuery)
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
	res, err := r.client.RangeQuery(ctx, logQL, query.From*1e6, query.To*1e6, query.Limit)
	if err != nil {
		return make([]*annotations.ItemDTO, 0), ErrLokiStoreInternal.Errorf("failed to query loki: %w", err)
	}

	items := make([]*annotations.ItemDTO, 0)
	for _, stream := range res.Data.Result {
		items = append(items, r.annotationsFromStream(ctx, stream, accessResources, ruleCache)...)
	}

	// order by time desc
	sort.Slice(items, func(i, j int) bool {
		return items[i].Time > items[j].Time
	})

	return items, err
}

func (r *LokiHistorianStore) annotationsFromStream(ctx context.Context, stream historian.Stream, ac accesscontrol.AccessResources, rc *ruleCache) []*annotations.ItemDTO {
	orgID, err := getOrgID(stream.Stream)
	if err != nil {
		r.log.Debug(fmt.Sprintf("could not get orgID for stream `%s`", stream), "err", err)
		return []*annotations.ItemDTO{}
	}

	items := make([]*annotations.ItemDTO, 0, len(stream.Values))
	for _, sample := range stream.Values {
		entry := historian.LokiEntry{}
		err := json.Unmarshal([]byte(sample.V), &entry)
		if err != nil {
			r.log.Debug(fmt.Sprintf("could not unmarshal entry `%s`", sample.V), "err", err)
			continue
		}

		if !hasAccess(entry, ac) {
			continue
		}

		transition, err := buildTransitionStub(&entry)
		if err != nil {
			r.log.Debug(fmt.Sprintf("could not build transition stub for entry `%v`", entry), "err", err)
			continue
		}
		if !historian.ShouldRecord(*transition) {
			continue
		}

		rule, err := rc.get(ctx, ruleQuery{OrgID: orgID, UID: entry.RuleUID})
		if err != nil {
			r.log.Debug(fmt.Sprintf("could not find rule with UID `%s`", entry.RuleUID), "entry", entry, "err", err)
			continue
		}

		annotationText, annotationData := historian.BuildAnnotationTextAndData(
			historymodel.RuleMeta{
				Title: rule.Title,
			},
			transition.State,
		)

		items = append(items, &annotations.ItemDTO{
			AlertID:      rule.ID,
			AlertName:    rule.Title,
			DashboardID:  0,
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

func hasAccess(entry historian.LokiEntry, resources accesscontrol.AccessResources) bool {
	if _, ok := resources.ScopeTypes[annotations.Organization.String()]; ok {
		if entry.DashboardUID != "" {
			return false
		}
	}

	if _, ok := resources.ScopeTypes[annotations.Dashboard.String()]; ok {
		_, canAccess := resources.Dashboards[entry.DashboardUID]
		if !canAccess {
			return false
		}
	}

	return true
}

// float64Map converts a simplejson map[string]any to a map[string]float64.
func float64Map(j *simplejson.Json) (map[string]float64, error) {
	m, err := j.Map()
	if err != nil {
		return nil, err
	}

	values := make(map[string]float64)
	for k, v := range m {
		a, ok := (v).(json.Number)
		if !ok {
			return nil, fmt.Errorf("unexpected value type %T", v)
		}

		f, err := a.Float64()
		if err != nil {
			return nil, err
		}

		values[k] = f
	}

	return values, nil
}

func buildTransitionStub(entry *historian.LokiEntry) (*state.StateTransition, error) {
	curState, curStateReason, err := state.ParseFormattedState(entry.Current)
	if err != nil {
		return nil, fmt.Errorf("parsing state: %w", err)
	}

	prevState, prevStateReason, err := state.ParseFormattedState(entry.Previous)
	if err != nil {
		return nil, fmt.Errorf("parsing state: %w", err)
	}

	v, err := float64Map(entry.Values)
	if err != nil {
		return nil, fmt.Errorf("parsing entry values: %w", err)
	}

	transition := &state.StateTransition{
		PreviousState:       prevState,
		PreviousStateReason: prevStateReason,
		State: &state.State{
			State:       curState,
			StateReason: curStateReason,
			Values:      v,
			Labels:      entry.InstanceLabels,
		},
	}
	if entry.Error != "" {
		transition.State.Error = errors.New(entry.Error)
	}

	return transition, nil
}

func buildHistoryQuery(ctx context.Context, query *annotations.ItemQuery, dashboards map[string]int64, rc *ruleCache) (ngmodels.HistoryQuery, error) {
	historyQuery := ngmodels.HistoryQuery{
		OrgID:        query.OrgID,
		DashboardUID: query.DashboardUID,
		PanelID:      query.PanelID,
	}

	if historyQuery.DashboardUID == "" && query.DashboardID == 0 {
		if uid, ok := invertMap(dashboards)[query.DashboardID]; ok {
			historyQuery.DashboardUID = uid
		}
	}

	if query.AlertID != 0 {
		rule, err := rc.get(ctx, ruleQuery{OrgID: query.OrgID, ID: query.AlertID})
		if err != nil {
			return ngmodels.HistoryQuery{}, err
		}
		historyQuery.RuleUID = rule.UID
	}

	return historyQuery, nil
}

func invertMap[T comparable, U comparable](m map[T]U) map[U]T {
	res := make(map[U]T, len(m))
	for k, v := range m {
		res[v] = k
	}
	return res
}

func getOrgID(labels map[string]string) (int64, error) {
	orgIDStr, ok := labels[historian.OrgIDLabel]
	if !ok {
		return 0, errors.New("missing orgID label")
	}

	orgID, err := strconv.ParseInt(orgIDStr, 10, 64)
	if err != nil {
		return 0, err
	}

	return orgID, nil
}

type ruleQuery struct {
	OrgID int64
	UID   string
	ID    int64
}

type ruleCache struct {
	queryFunc func(ctx context.Context, query ruleQuery) (*ngmodels.AlertRule, error)
	cache     map[string]*ngmodels.AlertRule
}

func newRuleCache(sql db.DB) *ruleCache {
	queryFunc := func(ctx context.Context, query ruleQuery) (*ngmodels.AlertRule, error) {
		bean := &ngmodels.AlertRule{OrgID: query.OrgID, ID: query.ID, UID: query.UID}
		err := sql.WithDbSession(ctx, func(sess *db.Session) error {
			exists, err := sess.Get(bean)
			if err != nil {
				return err
			}
			if !exists {
				return ErrMissingRule
			}
			return nil
		})
		return bean, err
	}

	return &ruleCache{
		cache:     make(map[string]*ngmodels.AlertRule),
		queryFunc: queryFunc,
	}
}

func (r *ruleCache) get(ctx context.Context, query ruleQuery) (*ngmodels.AlertRule, error) {
	if rule, ok := r.cache[query.UID]; ok {
		return rule, nil
	}

	rule, err := r.queryFunc(ctx, query)
	if err != nil {
		return nil, err
	}

	r.cache[query.UID] = rule

	return rule, nil
}
