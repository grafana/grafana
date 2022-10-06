package historian

import (
	"context"
	"fmt"
	"sort"
	"strconv"
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
)

// AnnotationStateHistorian is an implementation of state.Historian that uses Grafana Annotations as the backing datastore.
type AnnotationStateHistorian struct {
	annotations annotations.Repository
	dashboards  *dashboardResolver
	log         log.Logger
}

func NewAnnotationHistorian(annotations annotations.Repository, dashboards dashboards.DashboardService) *AnnotationStateHistorian {
	return &AnnotationStateHistorian{
		annotations: annotations,
		dashboards:  newDashboardResolver(dashboards, defaultDashboardCacheExpiry),
		log:         log.New("ngalert.state.historian"),
	}
}

func (h *AnnotationStateHistorian) RecordStates(ctx context.Context, states []state.ContextualState) {
	go h.recordStatesSync(ctx, states)
}

func (h *AnnotationStateHistorian) recordStatesSync(ctx context.Context, states []state.ContextualState) {
	items := make([]*annotations.Item, 0, len(states))
	for _, state := range states {
		logger := h.log.New(state.State.GetRuleKey().LogContext()...)
		logger.Debug("Alert state changed creating annotation", "newState", state.Formatted(), "oldState", state.PreviousFormatted())

		annotationText, annotationData := buildAnnotationTextAndData(state.RuleTitle, state.State)

		item := &annotations.Item{
			AlertId:   state.RuleID,
			OrgId:     state.OrgID,
			PrevState: state.PreviousFormatted(),
			NewState:  state.Formatted(),
			Text:      annotationText,
			Data:      annotationData,
			Epoch:     state.LastEvaluationTime.UnixNano() / int64(time.Millisecond),
		}

		dashUid, ok := state.Annotations[ngmodels.DashboardUIDAnnotation]
		if ok {
			panelUid := state.Annotations[ngmodels.PanelIDAnnotation]

			panelId, err := strconv.ParseInt(panelUid, 10, 64)
			if err != nil {
				logger.Error("Error parsing panelUID for alert annotation", "panelUID", panelUid, "error", err)
				return
			}

			dashID, err := h.dashboards.getID(ctx, state.OrgID, dashUid)
			if err != nil {
				logger.Error("Error getting dashboard for alert annotation", "dashboardUID", dashUid, "error", err)
				return
			}

			item.PanelId = panelId
			item.DashboardId = dashID
		}
		items = append(items, item)
	}

	if err := h.annotations.Save(ctx, items...); err != nil {
		affectedIDs := make([]int64, 0, len(items))
		for _, i := range items {
			affectedIDs = append(affectedIDs, i.AlertId)
		}
		h.log.Error("Error saving alert annotation batch", "alertRuleIDs", affectedIDs, "error", err)
		return
	}
}

func buildAnnotationTextAndData(title string, currentState *state.State) (string, *simplejson.Json) {
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
	return fmt.Sprintf("%s {%s} - %s", title, labels.String(), value), jsonData
}

func removePrivateLabels(labels data.Labels) data.Labels {
	result := make(data.Labels)
	for k, v := range labels {
		if !strings.HasPrefix(k, "__") && !strings.HasSuffix(k, "__") {
			result[k] = v
		}
	}
	return result
}
