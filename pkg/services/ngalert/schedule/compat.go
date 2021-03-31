package schedule

import (
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/prometheus/alertmanager/api/v2/models"
)

func FromAlertStateToPostableAlerts(firingStates []state.AlertState) []*notifier.PostableAlert {
	alerts := make([]*notifier.PostableAlert, 0, len(firingStates))
	for _, state := range firingStates {
		alerts = append(alerts, &notifier.PostableAlert{
			PostableAlert: models.PostableAlert{
				Annotations: models.LabelSet{}, //TODO: add annotations to evaluation results, add them to the state struct, and then set them before sending to the notifier
				StartsAt:    state.StartsAt,
				EndsAt:      state.EndsAt,
				Alert: models.Alert{
					Labels: models.LabelSet(state.Labels),
				},
			},
		})
	}
	return alerts
}
