package schedule

import (
	"github.com/go-openapi/strfmt"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/prometheus/alertmanager/api/v2/models"
)

func FromAlertStateToPostableAlerts(firingStates []state.AlertState) []*notifier.PostableAlert {
	alerts := make([]*notifier.PostableAlert, 0, len(firingStates))
	for _, alertState := range firingStates {
		if alertState.State == eval.Alerting {
			alerts = append(alerts, &notifier.PostableAlert{
				PostableAlert: models.PostableAlert{
					Annotations: alertState.Annotations,
					StartsAt:    strfmt.DateTime(alertState.StartsAt),
					EndsAt:      strfmt.DateTime(alertState.EndsAt),
					Alert: models.Alert{
						Labels: models.LabelSet(alertState.Labels),
					},
				},
			})
		}
	}
	return alerts
}
