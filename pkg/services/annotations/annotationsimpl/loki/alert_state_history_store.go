package loki

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/annotations/accesscontrol"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/state/historian"
	historymodel "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
)

// from grafana/pkg/services/ngalert/state/historian/loki.go
const defaultQueryRange = 6 * time.Hour

var (
	ErrLokiStoreInternal    = errutil.NewBase(errutil.StatusInternal, "annotations.loki.internal")
	ErrLokiStoreUnsupported = errutil.NotImplemented("annotations.loki.unsupported")
	ErrMissingRule          = errors.New("missing rule")
)

type lokiQueryClient interface {
	RangeQuery(ctx context.Context, query string, from, to, limit int64) (historian.QueryRes, error)
}

type AlertStateHistoryStore struct {
	client lokiQueryClient
	db     db.DB
	log    log.Logger
}

func NewLokiAlertStateHistoryStore(cfg *setting.Cfg, db db.DB, log log.Logger) (*AlertStateHistoryStore, error) {
	metrics := metrics.NewNGAlert(prometheus.DefaultRegisterer)

	clientCfg, err := historian.NewLokiConfig(cfg.UnifiedAlerting.StateHistory)
	if err != nil {
		return nil, fmt.Errorf("invalid remote loki configuration: %w", err)
	}
	client := historian.NewLokiClient(clientCfg, historian.NewRequester(), metrics.GetHistorianMetrics(), log)

	return &AlertStateHistoryStore{
		client: client,
		db:     db,
		log:    log,
	}, nil
}

func (r *AlertStateHistoryStore) Get(ctx context.Context, query *annotations.ItemQuery, accessResources accesscontrol.AccessResources) ([]*annotations.ItemDTO, error) {
	items := make([]*annotations.ItemDTO, 0)
	err := func() error {
		var rule *ngmodels.AlertRule
		var err error

		if query.AlertID != 0 {
			ruleQ := ruleQuery{ID: query.AlertID, OrgID: query.OrgID}
			rule, err = r.getRule(ctx, ruleQ)
			if err != nil {
				return ErrLokiStoreInternal.Errorf("failed to fetch rule: %w", err)
			}
		}

		histQuery := historyQueryFromItemQuery(ctx, query, rule, accessResources)

		logQL, err := historian.BuildLogQuery(histQuery)
		if err != nil {
			return ErrLokiStoreInternal.Errorf("failed to build log query: %w", err)
		}

		now := time.Now().UTC()
		if query.To == 0 {
			query.To = now.UnixMilli()
		}
		if query.From == 0 {
			query.From = now.Add(-defaultQueryRange).UnixMilli()
		}
		if query.From > query.To {
			to := query.To
			query.To = query.From
			query.From = to
		}

		res, err := r.client.RangeQuery(ctx, logQL, query.From, query.To, query.Limit)
		if err != nil {
			return ErrLokiStoreInternal.Errorf("failed to query loki: %w", err)
		}

		items = r.itemsFromStreams(ctx, query.OrgID, res.Data.Result, accessResources)

		// order by time desc
		sort.Slice(items, func(i, j int) bool {
			return items[i].Time > items[j].Time
		})

		return nil
	}()

	return items, err
}

// itemsFromStreams builds annotation items from a list of Loki streams.
// It will filter out items that the user does not have access to
// and will skip items that cannot be parsed.
func (r *AlertStateHistoryStore) itemsFromStreams(
	ctx context.Context,
	orgID int64,
	streams []historian.Stream,
	resources accesscontrol.AccessResources,
) []*annotations.ItemDTO {
	totalLen := 0
	for _, stream := range streams {
		totalLen += len(stream.Values)
	}

	rules := make(map[string]*ngmodels.AlertRule)
	items := make([]*annotations.ItemDTO, 0, totalLen)

	for _, stream := range streams {
		for _, sample := range stream.Values {
			var entry historian.LokiEntry
			err := json.Unmarshal([]byte(sample.V), &entry)
			if err != nil {
				r.log.Debug("could not parse Loki entry", "err", err)
				continue
			}

			transition, err := buildTransitionStub(&entry, sample.T)
			if err != nil {
				r.log.Debug("could not build state transition", "err", err)
				continue
			}

			if !shouldReplay(entry, transition, resources) {
				continue
			}

			rule, ok := rules[entry.RuleUID]
			if !ok {
				ruleQ := ruleQuery{OrgID: orgID, UID: entry.RuleUID}
				rule, err = r.getRule(ctx, ruleQ)
				if err != nil {
					r.log.Debug(fmt.Sprintf("could not find rule with UID `%s`", entry.RuleUID), "entry", entry, "err", err)
					continue
				}

				rules[entry.RuleUID] = rule
			}

			item, err := buildAnnotationItem(&entry, resources.Dashboards[entry.DashboardUID], rule, transition.State)
			if err != nil {
				r.log.Debug("could not build annotation item", "entry", entry, "err", err)
				continue
			}

			items = append(items, item)
		}
	}
	return items
}

type ruleQuery struct {
	OrgID int64
	UID   string
	ID    int64
}

func (r *AlertStateHistoryStore) getRule(ctx context.Context, query ruleQuery) (*ngmodels.AlertRule, error) {
	rule := &ngmodels.AlertRule{OrgID: query.OrgID}
	if query.UID != "" {
		rule.UID = query.UID
	}
	if query.ID != 0 {
		rule.ID = query.ID
	}

	err := r.db.WithDbSession(ctx, func(sess *db.Session) error {
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

// This store is read-only, so no other methods are implemented

func (r *AlertStateHistoryStore) Add(cxt context.Context, item *annotations.Item) error {
	return ErrLokiStoreUnsupported
}

func (r *AlertStateHistoryStore) AddMany(ctx context.Context, items []annotations.Item) error {
	return ErrLokiStoreUnsupported
}

func (r *AlertStateHistoryStore) Update(ctx context.Context, item *annotations.Item) error {
	return ErrLokiStoreUnsupported
}

func (r *AlertStateHistoryStore) Delete(ctx context.Context, params *annotations.DeleteParams) error {
	return ErrLokiStoreUnsupported
}

func (r *AlertStateHistoryStore) GetTags(ctx context.Context, query *annotations.TagsQuery) (annotations.FindTagsResult, error) {
	return annotations.FindTagsResult{}, ErrLokiStoreUnsupported
}

func (r *AlertStateHistoryStore) CleanAnnotations(ctx context.Context, cfg setting.AnnotationCleanupSettings, annotationType string) (int64, error) {
	return 0, ErrLokiStoreUnsupported
}

func (r *AlertStateHistoryStore) CleanOrphanedAnnotationTags(ctx context.Context) (int64, error) {
	return 0, ErrLokiStoreUnsupported
}

// util

func shouldReplay(entry historian.LokiEntry, transition *state.StateTransition, resources accesscontrol.AccessResources) bool {
	if !historian.ShouldRecord(*transition) {
		return false
	}

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

// parseFormattedState parses a state string in the format "state (reason)"
// and returns the state and reason separately.
func parseFormattedState(stateStr string) (eval.State, string, error) {
	split := strings.Split(stateStr, " ")
	if len(split) < 1 {
		return -1, "", errors.New("invalid state format")
	}

	state, err := eval.ParseStateString(split[0])
	if err != nil {
		return -1, "", err
	}

	var reason string
	if len(split) > 1 {
		reason = strings.Trim(split[1], "()")
	}

	return state, reason, nil
}

func buildTransitionStub(entry *historian.LokiEntry, time time.Time) (*state.StateTransition, error) {
	currState, currStateReason, err := parseFormattedState(entry.Current)
	if err != nil {
		return nil, fmt.Errorf("parsing state: %w", err)
	}

	prevState, prevStateReason, err := parseFormattedState(entry.Previous)
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
			LastEvaluationTime: time,
			State:              currState,
			StateReason:        currStateReason,
			Values:             v,
			Labels:             entry.InstanceLabels,
		},
	}
	if entry.Error != "" {
		transition.State.Error = errors.New(entry.Error)
	}

	return transition, nil
}

func buildAnnotationItem(entry *historian.LokiEntry, dashID int64, rule *ngmodels.AlertRule, s *state.State) (*annotations.ItemDTO, error) {
	annotationText, annotationData := historian.BuildAnnotationTextAndData(
		historymodel.RuleMeta{
			Title: rule.Title,
		},
		s,
	)

	item := &annotations.ItemDTO{
		AlertID:      rule.ID,
		AlertName:    rule.Title,
		DashboardID:  dashID,
		DashboardUID: &entry.DashboardUID,
		PanelID:      entry.PanelID,
		NewState:     entry.Current,
		PrevState:    entry.Previous,
		Time:         s.LastEvaluationTime.UnixMilli(),
		Text:         annotationText,
		Data:         annotationData,
	}

	return item, nil
}

func historyQueryFromItemQuery(
	ctx context.Context,
	query *annotations.ItemQuery,
	rule *ngmodels.AlertRule,
	accessResources accesscontrol.AccessResources,
) ngmodels.HistoryQuery {
	histQuery := ngmodels.HistoryQuery{
		OrgID: query.OrgID,
	}

	if rule != nil {
		histQuery.RuleUID = rule.UID
	}

	// if dashboard id is set, we have already checked that the user has access to it
	// which means it exists in the accessResources map
	if query.DashboardID != 0 {
		for uid, id := range accessResources.Dashboards {
			if id == query.DashboardID {
				histQuery.DashboardUID = uid
				break
			}
		}
	}

	if query.PanelID != 0 {
		histQuery.PanelID = query.PanelID
	}

	if query.From > 0 && query.To > 0 {
		histQuery.From = time.Unix(query.From, 0)
		histQuery.To = time.Unix(query.To, 0)
	}

	return histQuery
}
