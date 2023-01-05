package historian

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

// AnnotationBackend is an implementation of state.Historian that uses Grafana Annotations as the backing datastore.
type AnnotationBackend struct {
	annotations annotations.Repository
	dashboards  *dashboardResolver
	log         log.Logger
}

func NewAnnotationBackend(annotations annotations.Repository, dashboards dashboards.DashboardService) *AnnotationBackend {
	return &AnnotationBackend{
		annotations: annotations,
		dashboards:  newDashboardResolver(dashboards, defaultDashboardCacheExpiry),
		log:         log.New("ngalert.state.historian"),
	}
}

// RecordStates writes a number of state transitions for a given rule to state history.
func (h *AnnotationBackend) RecordStatesAsync(ctx context.Context, rule *ngmodels.AlertRule, states []state.StateTransition) {
	logger := h.log.FromContext(ctx)
	// Build annotations before starting goroutine, to make sure all data is copied and won't mutate underneath us.
	annotations := h.buildAnnotations(rule, states, logger)
	panel := parsePanelKey(rule, logger)
	go h.recordAnnotationsSync(ctx, panel, annotations, logger)
}

func (h *AnnotationBackend) buildAnnotations(rule *ngmodels.AlertRule, states []state.StateTransition, logger log.Logger) []annotations.Item {
	items := make([]annotations.Item, 0, len(states))
	for _, state := range states {
		if !shouldRecord(state) {
			continue
		}
		logger.Debug("Alert state changed creating annotation", "newState", state.Formatted(), "oldState", state.PreviousFormatted())

		annotationText, annotationData := buildAnnotationTextAndData(rule, state.State)

		item := annotations.Item{
			AlertId:   rule.ID,
			OrgId:     state.OrgID,
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

func (h *AnnotationBackend) recordAnnotationsSync(ctx context.Context, panel *panelKey, annotations []annotations.Item, logger log.Logger) {
	if panel != nil {
		dashID, err := h.dashboards.getID(ctx, panel.orgID, panel.dashUID)
		if err != nil {
			logger.Error("Error getting dashboard for alert annotation", "dashboardUID", panel.dashUID, "error", err)
			return
		}

		for i := range annotations {
			annotations[i].DashboardId = dashID
			annotations[i].PanelId = panel.panelID
		}
	}

	if err := h.annotations.SaveMany(ctx, annotations); err != nil {
		logger.Error("Error saving alert annotation batch", "error", err)
	}

	logger.Debug("Done saving alert annotation batch")
}

func buildAnnotationTextAndData(rule *ngmodels.AlertRule, currentState *state.State) (string, *simplejson.Json) {
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
		jsonData.Set("values", simplejson.NewFromAny(currentState.Values))
		value = strings.Join(values, ", ")
	}

	labels := removePrivateLabels(currentState.Labels)
	return fmt.Sprintf("%s {%s} - %s", rule.Title, labels.String(), value), jsonData
}
