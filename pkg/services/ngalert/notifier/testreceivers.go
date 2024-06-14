package notifier

import (
	"context"
	"encoding/json"
	"time"

	alertingNotify "github.com/grafana/alerting/notify"

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

func (am *alertmanager) TestReceivers(ctx context.Context, c apimodels.TestReceiversConfigBodyParams) (*TestReceiversResult, error) {
	receivers := make([]*alertingNotify.APIReceiver, 0, len(c.Receivers))
	for _, r := range c.Receivers {
		integrations := make([]*alertingNotify.GrafanaIntegrationConfig, 0, len(r.GrafanaManagedReceivers))
		for _, gr := range r.PostableGrafanaReceivers.GrafanaManagedReceivers {
			integrations = append(integrations, &alertingNotify.GrafanaIntegrationConfig{
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
			GrafanaIntegrations: alertingNotify.GrafanaIntegrations{
				Integrations: integrations,
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

func (am *alertmanager) GetReceivers(_ context.Context) ([]apimodels.Receiver, error) {
	return am.Base.GetReceivers(), nil
}
