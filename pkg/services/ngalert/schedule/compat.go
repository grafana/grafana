package schedule

import (
	"time"

	"github.com/go-openapi/strfmt"

	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/prometheus/alertmanager/api/v2/models"
)

func FromStateToPostableAlert(alertState state.AlertState) *notifier.PostableAlert {
	return &notifier.PostableAlert{
		PostableAlert: models.PostableAlert{
			Annotations: models.LabelSet{},
			StartsAt:    strfmt.DateTime(alertState.StartAt),
			//TODO: When calculating if an alert should not be firing anymore, we should take three things into account:
			// 1. The re-send the delay if any, we don't want to send every firing alert every time, we should have a fixed delay across all alerts to avoid saturating the notification system
			// 2. The evaluation interval defined for this particular alert - we don't support that yet but will eventually allow you to define how often do you want this alert to be evaluted
			// 3. The base interval defined by the scheduler - in the case where #2 is not yet an option we can use the base interval at which every alert runs.
			EndsAt: strfmt.DateTime(alertState.FiredAt.Add(40 * time.Second)),
			Alert: models.Alert{
				Labels: models.LabelSet(alertState.Labels),
			},
		},
	}
}
