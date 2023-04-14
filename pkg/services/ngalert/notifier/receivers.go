package notifier

import (
	"context"
	"encoding/json"
	"time"

	alertingNotify "github.com/grafana/alerting/notify"

	"github.com/go-openapi/strfmt"
	"github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/alertmanager/types"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

type TestReceiversResult struct {
	Alert     types.Alert
	Receivers []TestReceiverResult
	NotifedAt time.Time
}

type TestReceiverResult struct {
	Name    string
	Configs []TestReceiverConfigResult
}

type TestReceiverConfigResult struct {
	Name   string
	UID    string
	Status string
	Error  error
}

func (am *Alertmanager) TestReceivers(ctx context.Context, c apimodels.TestReceiversConfigBodyParams) (*TestReceiversResult, error) {
	receivers := make([]*alertingNotify.APIReceiver, 0, len(c.Receivers))
	for _, r := range c.Receivers {
		greceivers := make([]*alertingNotify.GrafanaReceiver, 0, len(r.GrafanaManagedReceivers))
		for _, gr := range r.PostableGrafanaReceivers.GrafanaManagedReceivers {
			greceivers = append(greceivers, &alertingNotify.GrafanaReceiver{
				UID:                   gr.UID,
				Name:                  gr.Name,
				Type:                  gr.Type,
				DisableResolveMessage: gr.DisableResolveMessage,
				Settings:              json.RawMessage(gr.Settings),
				SecureSettings:        gr.SecureSettings,
			})
		}
		receivers = append(receivers, &alertingNotify.APIReceiver{
			ConfigReceiver: r.Receiver,
			GrafanaReceivers: alertingNotify.GrafanaReceivers{
				Receivers: greceivers,
			},
		})
	}
	var alert *alertingNotify.TestReceiversConfigAlertParams
	if c.Alert != nil {
		alert = &alertingNotify.TestReceiversConfigAlertParams{Annotations: c.Alert.Annotations, Labels: c.Alert.Labels}
	}

	result, err := am.Base.TestReceivers(ctx, alertingNotify.TestReceiversConfigBodyParams{
		Alert:     alert,
		Receivers: receivers,
	})

	if err != nil {
		return nil, err
	}

	resultReceivers := make([]TestReceiverResult, 0, len(result.Receivers))
	for _, resultReceiver := range result.Receivers {
		configs := make([]TestReceiverConfigResult, 0, len(resultReceiver.Configs))
		for _, c := range resultReceiver.Configs {
			configs = append(configs, TestReceiverConfigResult{
				Name:   c.Name,
				UID:    c.UID,
				Status: c.Status,
				Error:  c.Error,
			})
		}
		resultReceivers = append(resultReceivers, TestReceiverResult{
			Name:    resultReceiver.Name,
			Configs: configs,
		})
	}

	return &TestReceiversResult{
		Alert:     result.Alert,
		Receivers: resultReceivers,
		NotifedAt: result.NotifedAt,
	}, err
}

func (am *Alertmanager) GetReceivers(_ context.Context) []apimodels.Receiver {
	apiReceivers := make([]apimodels.Receiver, 0, len(am.Base.GetReceivers()))
	for _, rcv := range am.Base.GetReceivers() {
		// Build integrations slice for each receiver.
		integrations := make([]*models.Integration, 0, len(rcv.Integrations()))
		for _, integration := range rcv.Integrations() {
			name := integration.Name()
			sendResolved := integration.SendResolved()
			ts, d, err := integration.GetReport()
			integrations = append(integrations, &apimodels.Integration{
				Name:                      &name,
				SendResolved:              &sendResolved,
				LastNotifyAttempt:         strfmt.DateTime(ts),
				LastNotifyAttemptDuration: d.String(),
				LastNotifyAttemptError: func() string {
					if err != nil {
						return err.Error()
					}
					return ""
				}(),
			})
		}

		active := rcv.Active()
		name := rcv.Name()
		apiReceivers = append(apiReceivers, apimodels.Receiver{
			Active:       &active,
			Integrations: integrations,
			Name:         &name,
		})
	}

	return apiReceivers
}
