package historian

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/dashboards"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

// AnnotationStateHistorian is an implementation of state.Historian that uses Grafana Annotations as the backing datastore.
type AnnotationStateHistorian struct {
	annotations annotations.Repository
	dashboards  *dashboardResolver
	log         log.Logger
}

func NewAnnotationHistorian(annotations annotations.Repository, dashboards dashboards.DashboardService, log log.Logger) *AnnotationStateHistorian {
	return &AnnotationStateHistorian{
		annotations: annotations,
		dashboards:  newDashboardResolver(dashboards, log, defaultDashboardCacheExpiry),
		log:         log,
	}
}

func (h *AnnotationStateHistorian) RecordState(ctx context.Context, rule *ngmodels.AlertRule, labels data.Labels, evaluatedAt time.Time, currentData, previousData state.InstanceStateAndReason) {
	h.log.Debug("alert state changed creating annotation", "alertRuleUID", rule.UID, "newState", currentData.String(), "oldState", previousData.String())

	labels = removePrivateLabels(labels)
	annotationText := fmt.Sprintf("%s {%s} - %s", rule.Title, labels.String(), currentData.String())

	item := &annotations.Item{
		AlertId:   rule.ID,
		OrgId:     rule.OrgID,
		PrevState: previousData.String(),
		NewState:  currentData.String(),
		Text:      annotationText,
		Epoch:     evaluatedAt.UnixNano() / int64(time.Millisecond),
	}

	dashUid, ok := rule.Annotations[ngmodels.DashboardUIDAnnotation]
	if ok {
		panelUid := rule.Annotations[ngmodels.PanelIDAnnotation]

		panelId, err := strconv.ParseInt(panelUid, 10, 64)
		if err != nil {
			h.log.Error("error parsing panelUID for alert annotation", "panelUID", panelUid, "alertRuleUID", rule.UID, "err", err.Error())
			return
		}

		dashID, err := h.dashboards.getID(ctx, rule.OrgID, dashUid)
		if err != nil {
			h.log.Error("error getting dashboard for alert annotation", "dashboardUID", dashUid, "alertRuleUID", rule.UID, "err", err.Error())
			return
		}

		item.PanelId = panelId
		item.DashboardId = dashID
	}

	if err := h.annotations.Save(ctx, item); err != nil {
		h.log.Error("error saving alert annotation", "alertRuleUID", rule.UID, "err", err.Error())
		return
	}
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
