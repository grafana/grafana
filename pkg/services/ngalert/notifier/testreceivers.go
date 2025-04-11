package notifier

import (
	"context"
	"encoding/json"

	alertingNotify "github.com/grafana/alerting/notify"
	v2 "github.com/prometheus/alertmanager/api/v2"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

func (am *alertmanager) TestReceivers(ctx context.Context, c apimodels.TestReceiversConfigBodyParams) (*alertingNotify.TestReceiversResult, int, error) {
	receivers := make([]*alertingNotify.APIReceiver, 0, len(c.Receivers))
	for _, r := range c.Receivers {
		integrations := make([]*alertingNotify.GrafanaIntegrationConfig, 0, len(r.GrafanaManagedReceivers))
		for _, gr := range r.GrafanaManagedReceivers {
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
	a := &alertingNotify.PostableAlert{}
	if c.Alert != nil {
		a.Annotations = v2.ModelLabelSetToAPILabelSet(c.Alert.Annotations)
		a.Labels = v2.ModelLabelSetToAPILabelSet(c.Alert.Labels)
	}
	AddDefaultLabelsAndAnnotations(a)
	return am.Base.TestReceivers(ctx, alertingNotify.TestReceiversConfigBodyParams{
		Alert: &alertingNotify.TestReceiversConfigAlertParams{
			Annotations: v2.APILabelSetToModelLabelSet(a.Annotations),
			Labels:      v2.APILabelSetToModelLabelSet(a.Labels),
		},
		Receivers: receivers,
	})
}

func (am *alertmanager) GetReceivers(_ context.Context) ([]apimodels.Receiver, error) {
	return am.Base.GetReceivers(), nil
}
