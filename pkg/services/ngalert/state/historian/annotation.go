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

func NewAnnotationHistorian(annotations annotations.Repository, dashboards dashboards.DashboardService) *AnnotationStateHistorian {
	return &AnnotationStateHistorian{
		annotations: annotations,
		dashboards:  newDashboardResolver(dashboards, defaultDashboardCacheExpiry),
		log:         log.New("ngalert.state.historian"),
	}
}

func (h *AnnotationStateHistorian) RecordState(ctx context.Context, rule *ngmodels.AlertRule, labels data.Labels, evaluatedAt time.Time, currentData, previousData state.InstanceStateAndReason) {
	logger := h.log.New(rule.GetKey().LogContext()...)
	logger.Debug("Alert state changed creating annotation", "newState", currentData.String(), "oldState", previousData.String())

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
			logger.Error("Error parsing panelUID for alert annotation", "panelUID", panelUid, "error", err)
			return
		}

		dashID, err := h.dashboards.getID(ctx, rule.OrgID, dashUid)
		if err != nil {
			logger.Error("Error getting dashboard for alert annotation", "dashboardUID", dashUid, "error", err)
			return
		}

		item.PanelId = panelId
		item.DashboardId = dashID
	}

	if err := h.annotations.Save(ctx, item); err != nil {
		logger.Error("Error saving alert annotation", "error", err)
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
