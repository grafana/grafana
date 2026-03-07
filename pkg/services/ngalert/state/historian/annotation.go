package historian

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
)

type AccessControl interface {
	CanReadAllRules(ctx context.Context, user identity.Requester) (bool, error)
	AuthorizeAccessInFolder(ctx context.Context, user identity.Requester, rule ngmodels.Namespaced) error
	HasAccessInFolder(ctx context.Context, user identity.Requester, rule ngmodels.Namespaced) (bool, error)
}

// AnnotationBackend is an implementation of state.Historian that uses Grafana Annotations as the backing datastore.
type AnnotationBackend struct {
	store         AnnotationStore
	rules         RuleStore
	clock         clock.Clock
	metrics       *metrics.Historian
	log           log.Logger
	ac            AccessControl
	maxTagsLength int64 // Max length for annotation tags to avoid storage errors
}

type RuleStore interface {
	GetAlertRuleByUID(ctx context.Context, query *ngmodels.GetAlertRuleByUIDQuery) (*ngmodels.AlertRule, error)
	GetUserVisibleNamespaces(ctx context.Context, orgID int64, user identity.Requester) (map[string]*folder.Folder, error)
	GetAlertRuleVersionFolders(ctx context.Context, orgID int64, guid string) ([]string, error)
}

type AnnotationStore interface {
	Find(ctx context.Context, query *annotations.ItemQuery) ([]*annotations.ItemDTO, error)
	Save(ctx context.Context, panel *PanelKey, annotations []annotations.Item, orgID int64, logger log.Logger) error
}

func NewAnnotationBackend(
	logger log.Logger,
	annotations AnnotationStore,
	rules RuleStore,
	metrics *metrics.Historian,
	ac AccessControl,
	maxTagsLength int64,
) *AnnotationBackend {
	return &AnnotationBackend{
		store:         annotations,
		rules:         rules,
		clock:         clock.New(),
		metrics:       metrics,
		log:           logger,
		ac:            ac,
		maxTagsLength: maxTagsLength,
	}
}

// Record writes a number of state transitions for a given rule to state history.
func (h *AnnotationBackend) Record(ctx context.Context, rule history_model.RuleMeta, states []state.StateTransition) <-chan error {
	logger := h.log.FromContext(ctx)
	// Build annotations before starting goroutine, to make sure all data is copied and won't mutate underneath us.
	annotations := h.buildAnnotations(rule, states, logger)
	panel := parsePanelKey(rule, logger)

	errCh := make(chan error, 1)
	if len(annotations) == 0 {
		close(errCh)
		return errCh
	}

	// This is a new background job, so let's create a brand new context for it.
	// We want it to be isolated, i.e. we don't want grafana shutdowns to interrupt this work
	// immediately but rather try to flush writes.
	// This also prevents timeouts or other lingering objects (like transactions) from being
	// incorrectly propagated here from other areas.
	writeCtx := context.Background()
	writeCtx, cancel := context.WithTimeout(writeCtx, StateHistoryWriteTimeout)
	writeCtx = history_model.WithRuleData(writeCtx, rule)
	writeCtx = trace.ContextWithSpan(writeCtx, trace.SpanFromContext(ctx))

	go func(ctx context.Context) {
		defer cancel()
		defer close(errCh)
		logger := h.log.FromContext(ctx)
		logger.Debug("Saving state history batch", "samples", len(annotations))

		err := h.store.Save(ctx, panel, annotations, rule.OrgID, logger)
		if err != nil {
			logger.Error("Failed to save history batch", "samples", len(annotations), "err", err)
			errCh <- err
			return
		}
		logger.Debug("Done saving history batch", "samples", len(annotations))
	}(writeCtx)
	return errCh
}

// Query filters state history annotations and formats them into a dataframe.
func (h *AnnotationBackend) Query(ctx context.Context, query ngmodels.HistoryQuery) (*data.Frame, error) {
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
	rule, err := h.rules.GetAlertRuleByUID(ctx, &rq)
	if err != nil {
		return nil, fmt.Errorf("failed to look up the requested rule")
	}
	if rule == nil {
		return nil, fmt.Errorf("no such rule exists")
	}

	if err := h.ac.AuthorizeAccessInFolder(ctx, query.SignedInUser, rule); err != nil {
		return nil, err
	}

	q := annotations.ItemQuery{
		AlertID:      rule.ID,
		OrgID:        query.OrgID,
		From:         query.From.UnixMilli(),
		To:           query.To.UnixMilli(),
		SignedInUser: query.SignedInUser,
	}
	items, err := h.store.Find(ctx, &q)
	if err != nil {
		return nil, fmt.Errorf("failed to query annotations for state history: %w", err)
	}

	frame := data.NewFrame("states")

	// Annotations only support querying for a single rule's history.
	// Since we are guaranteed to have a single rule, we can return it as a single series.
	// Also, annotations don't store labels in a strongly defined format. They are formatted into the label's text.
	// We are not guaranteed that a given annotation has parseable text, so we instead use the entire text as an opaque value.

	lbls := data.Labels(map[string]string{
		"from":    "state-history",
		"ruleUID": fmt.Sprint(query.RuleUID),
	})

	// TODO: In the future, we probably want to have one series per unique text string, instead. For simplicity, let's just make it a new column.
	//
	// TODO: This is a really naive mapping that will evolve in the next couple changes.
	// TODO: It will converge over time with the other implementations.
	//
	// We represent state history as five vectors:
	//   1. `time` - when the transition happened
	//   2. `text` - a text string containing metadata about the rule
	//   3. `prev` - the previous state and reason
	//   4. `next` - the next state and reason
	//   5. `data` - a JSON string, containing the annotation's contents. analogous to item.Data
	times := make([]time.Time, 0, len(items))
	texts := make([]string, 0, len(items))
	prevStates := make([]string, 0, len(items))
	nextStates := make([]string, 0, len(items))
	values := make([]string, 0, len(items))
	for _, item := range items {
		data, err := json.Marshal(item.Data)
		if err != nil {
			logger.Error("Annotation service gave an annotation with unparseable data, skipping", "id", item.ID, "err", err)
			continue
		}
		times = append(times, time.Unix(item.Time, 0))
		texts = append(texts, item.Text)
		prevStates = append(prevStates, item.PrevState)
		nextStates = append(nextStates, item.NewState)
		values = append(values, string(data))
	}

	frame.Fields = append(frame.Fields, data.NewField("time", lbls, times))
	frame.Fields = append(frame.Fields, data.NewField("text", lbls, texts))
	frame.Fields = append(frame.Fields, data.NewField("prev", lbls, prevStates))
	frame.Fields = append(frame.Fields, data.NewField("next", lbls, nextStates))
	frame.Fields = append(frame.Fields, data.NewField("data", lbls, values))

	return frame, nil
}

func (h *AnnotationBackend) buildAnnotations(rule history_model.RuleMeta, states []state.StateTransition, logger log.Logger) []annotations.Item {
	items := make([]annotations.Item, 0, len(states))
	for _, state := range states {
		if !ShouldRecordAnnotation(state) {
			continue
		}
		logger.Debug("Alert state changed creating annotation", "newState", state.Formatted(), "oldState", state.PreviousFormatted())

		annotationText, annotationData, tags := BuildAnnotationTextAndData(rule, state.State, h.maxTagsLength)

		item := annotations.Item{
			AlertID:   rule.ID,
			OrgID:     state.OrgID,
			PrevState: state.PreviousFormatted(),
			NewState:  state.Formatted(),
			Text:      annotationText,
			Data:      annotationData,
			Tags:      tags,
			Epoch:     state.LastEvaluationTime.UnixNano() / int64(time.Millisecond),
		}

		items = append(items, item)
	}
	return items
}

// BuildAnnotationTextAndData creates the annotation text, JSON data, and tags for an alert state transition.
// maxTagsLength limits the total serialized length of tags to avoid storage errors.
func BuildAnnotationTextAndData(rule history_model.RuleMeta, currentState *state.State, maxTagsLength int64) (string, *simplejson.Json, []string) {
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

		values := make([]string, 0, len(keys))
		for _, k := range keys {
			values = append(values, fmt.Sprintf("%s=%f", k, currentState.Values[k]))
		}
		jsonData.Set("values", jsonifyValues(currentState.Values))
		value = strings.Join(values, ", ")
	}

	// Filter private labels once and use for both text and tags
	labels := removePrivateLabels(currentState.Labels)
	tags := convertLabelsToTags(labels, maxTagsLength)

	return fmt.Sprintf("%s {%s} - %s", rule.Title, labels.String(), value), jsonData, tags
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

// convertLabelsToTags converts alert labels to annotation tags.
// Tags are in "key:value" format, sorted alphabetically.
// Colons in both label keys and values are replaced with underscores to ensure proper parsing.
// Tags are truncated if they would exceed maxLength to avoid storage errors.
// Length calculation accounts for JSON array encoding: ["tag1","tag2",...]
func convertLabelsToTags(labels data.Labels, maxLength int64) []string {
	if len(labels) == 0 {
		return nil
	}

	// Sort keys for deterministic tag order
	keys := make([]string, 0, len(labels))
	for k := range labels {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	// Single pass: create tags and apply length limit
	tags := make([]string, 0, len(keys))
	var currentLength int64 = 2 // [ and ]

	for i, k := range keys {
		// Escape colons in both key and value to ensure proper parsing by tag.ParseTagPairs
		safeKey := strings.ReplaceAll(k, ":", "_")
		safeValue := strings.ReplaceAll(labels[k], ":", "_")
		tag := fmt.Sprintf("%s:%s", safeKey, safeValue)

		// Check if this tag fits within maxLength
		if maxLength > 0 {
			tagLength := int64(len(tag) + 2) // quotes
			if i > 0 {
				tagLength++ // comma
			}
			if currentLength+tagLength > maxLength {
				break // Stop adding tags
			}
			currentLength += tagLength
		}

		tags = append(tags, tag)
	}

	if len(tags) == 0 {
		return nil
	}
	return tags
}
