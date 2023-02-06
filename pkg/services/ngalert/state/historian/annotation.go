package historian

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
)

// AnnotationBackend is an implementation of state.Historian that uses Grafana Annotations as the backing datastore.
type AnnotationBackend struct {
	annotations annotations.Repository
	dashboards  *dashboardResolver
	rules       RuleStore
	log         log.Logger
}

type RuleStore interface {
	GetAlertRuleByUID(ctx context.Context, query *ngmodels.GetAlertRuleByUIDQuery) error
}

func NewAnnotationBackend(annotations annotations.Repository, dashboards dashboards.DashboardService, rules RuleStore) *AnnotationBackend {
	return &AnnotationBackend{
		annotations: annotations,
		dashboards:  newDashboardResolver(dashboards, defaultDashboardCacheExpiry),
		rules:       rules,
		log:         log.New("ngalert.state.historian"),
	}
}

// RecordStates writes a number of state transitions for a given rule to state history.
func (h *AnnotationBackend) RecordStatesAsync(ctx context.Context, rule history_model.RuleMeta, states []state.StateTransition) <-chan error {
	logger := h.log.FromContext(ctx)
	// Build annotations before starting goroutine, to make sure all data is copied and won't mutate underneath us.
	annotations := buildAnnotations(rule, states, logger)
	panel := parsePanelKey(rule, logger)
	errCh := make(chan error, 1)
	go func() {
		defer close(errCh)
		errCh <- h.recordAnnotationsSync(ctx, panel, annotations, logger)
	}()
	return errCh
}

func (h *AnnotationBackend) QueryStates(ctx context.Context, query ngmodels.HistoryQuery) (*data.Frame, error) {
	logger := h.log.FromContext(ctx)
	if query.RuleUID == "" {
		return nil, fmt.Errorf("ruleUID is required to query annotations")
	}

	if query.Labels != nil {
		logger.Warn("Annotation state history backend does not support label queries, ignoring that filter")
	}

	rq := ngmodels.GetAlertRuleByUIDQuery{
		UID:   query.RuleUID,
		OrgID: query.OrgID,
	}
	err := h.rules.GetAlertRuleByUID(ctx, &rq)
	if err != nil {
		return nil, fmt.Errorf("failed to look up the requested rule")
	}
	if rq.Result == nil {
		return nil, fmt.Errorf("no such rule exists")
	}

	q := annotations.ItemQuery{
		AlertID:      rq.Result.ID,
		OrgID:        query.OrgID,
		From:         query.From.Unix(),
		To:           query.To.Unix(),
		SignedInUser: query.SignedInUser,
	}
	items, err := h.annotations.Find(ctx, &q)
	if err != nil {
		return nil, fmt.Errorf("failed to query annotations for state history: %w", err)
	}

	frame := data.NewFrame(dfStreamTitle)

	// Annotations only support querying for a single rule's history.
	// Since we are guaranteed to have a single rule, we can return it as a single series.
	// Also, annotations don't store labels in a strongly defined format. They are formatted into the label's text.
	// We are not guaranteed that a given annotation has parseable text, so we instead use the entire text as an opaque value.

	columnLbls := data.Labels(map[string]string{
		StateHistoryLabelKey: StateHistoryLabelValue,
		LabelRuleUID:         fmt.Sprint(query.RuleUID),
	})

	// TODO: This is a really naive mapping that will evolve in the next couple changes.
	// TODO: It will converge over time with the other implementations.
	//
	// We represent state history from annotations as five vectors:
	//   1. `time` - when the transition happened
	//   2. `text` - a text string containing metadata about the rule
	//   3. `line` - a JSON object, containing most of the annotation's data fields

	type annotationsEntry struct {
		SchemaVersion int    `json:"schemaVersion"`
		Previous      string `json:"previous"`
		Current       string `json:"current"`
		// Values is synonymous to item.Data, the data field from an annotation.
		Values       *simplejson.Json `json:"values"`
		DashboardUID string           `json:"dashboardUID"`
		PanelID      int64            `json:"panelID"`
	}

	times := make([]time.Time, 0, len(items))
	texts := make([]string, 0, len(items))
	lines := make([]json.RawMessage, 0, len(items))
	for _, item := range items {
		var dashUID string
		if item.DashboardUID != nil {
			dashUID = *item.DashboardUID // TODO: Doesn't alerting only fill out the ID field? Does this get auto-populated?
		}
		entry := annotationsEntry{
			SchemaVersion: 1,
			Previous:      item.PrevState,
			Current:       item.NewState,
			Values:        item.Data,
			DashboardUID:  dashUID,
			PanelID:       item.PanelID,
		}

		line, err := json.Marshal(entry)
		if err != nil {
			logger.Error("Annotation service gave an annotation with unparseable data, skipping", "id", item.ID, "err", err)
			continue
		}
		times = append(times, time.Unix(item.Time, 0))
		texts = append(texts, item.Text)
		lines = append(lines, line)
	}

	frame.Fields = append(frame.Fields, data.NewField(dfTime, columnLbls, times))
	frame.Fields = append(frame.Fields, data.NewField("text", columnLbls, texts))
	frame.Fields = append(frame.Fields, data.NewField(dfLine, columnLbls, lines))

	return frame, nil
}

func buildAnnotations(rule history_model.RuleMeta, states []state.StateTransition, logger log.Logger) []annotations.Item {
	items := make([]annotations.Item, 0, len(states))
	for _, state := range states {
		if !shouldRecord(state) {
			continue
		}
		logger.Debug("Alert state changed creating annotation", "newState", state.Formatted(), "oldState", state.PreviousFormatted())

		annotationText, annotationData := buildAnnotationTextAndData(rule, state.State)

		item := annotations.Item{
			AlertID:   rule.ID,
			OrgID:     state.OrgID,
			PrevState: state.PreviousFormatted(),
			NewState:  state.Formatted(),
			Text:      annotationText,
			Data:      annotationData,
			Epoch:     state.LastEvaluationTime.UnixNano() / int64(time.Millisecond),
		}

		items = append(items, item)
	}
	return items
}

func (h *AnnotationBackend) recordAnnotationsSync(ctx context.Context, panel *panelKey, annotations []annotations.Item, logger log.Logger) error {
	if panel != nil {
		dashID, err := h.dashboards.getID(ctx, panel.orgID, panel.dashUID)
		if err != nil {
			logger.Error("Error getting dashboard for alert annotation", "dashboardUID", panel.dashUID, "error", err)
			dashID = 0
		}

		for i := range annotations {
			annotations[i].DashboardID = dashID
			annotations[i].PanelID = panel.panelID
		}
	}

	if err := h.annotations.SaveMany(ctx, annotations); err != nil {
		logger.Error("Error saving alert annotation batch", "error", err)
		return fmt.Errorf("error saving alert annotation batch: %w", err)
	}

	logger.Debug("Done saving alert annotation batch")
	return nil
}

func buildAnnotationTextAndData(rule history_model.RuleMeta, currentState *state.State) (string, *simplejson.Json) {
	jsonData := simplejson.New()
	var value string

	switch currentState.State {
	case eval.Error:
		if currentState.Error == nil {
			jsonData.Set("error", nil)
		} else {
			jsonData.Set("error", currentState.Error.Error())
		}
		value = "Error"
	case eval.NoData:
		jsonData.Set("noData", true)
		value = "No data"
	default:
		keys := make([]string, 0, len(currentState.Values))
		for k := range currentState.Values {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		var values []string
		for _, k := range keys {
			values = append(values, fmt.Sprintf("%s=%f", k, currentState.Values[k]))
		}
		jsonData.Set("values", jsonifyValues(currentState.Values))
		value = strings.Join(values, ", ")
	}

	labels := removePrivateLabels(currentState.Labels)
	return fmt.Sprintf("%s {%s} - %s", rule.Title, labels.String(), value), jsonData
}

func jsonifyValues(vs map[string]float64) *simplejson.Json {
	if vs == nil {
		return nil
	}

	j := simplejson.New()
	for k, v := range vs {
		switch {
		case math.IsInf(v, 0), math.IsNaN(v):
			j.Set(k, fmt.Sprintf("%f", v))
		default:
			j.Set(k, v)
		}
	}
	return j
}
