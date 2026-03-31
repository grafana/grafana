package notifier

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/alerting/models"
	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/grafana/alerting/receivers/schema"
	v2 "github.com/prometheus/alertmanager/api/v2"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

func (am *alertmanager) TestReceivers(ctx context.Context, c apimodels.TestReceiversConfigBodyParams) (*alertingNotify.TestReceiversResult, int, error) {
	receivers := make([]*alertingNotify.APIReceiver, 0, len(c.Receivers))
	for _, r := range c.Receivers {
		integrations := make([]*models.IntegrationConfig, 0, len(r.GrafanaManagedReceivers))
		for _, gr := range r.GrafanaManagedReceivers {
			iType, err := alertingNotify.IntegrationTypeFromString(gr.Type)
			if err != nil {
				return nil, 0, err
			}
			iVersion := schema.V1
			if gr.Version != "" {
				iVersion = schema.Version(gr.Version)
				if _, ok := alertingNotify.GetSchemaVersionForIntegration(iType, iVersion); !ok {
					return nil, 0, fmt.Errorf("integration version %s is not available for integration type %s", gr.Version, gr.Type)
				}
			}

			integrations = append(integrations, &models.IntegrationConfig{
				UID:                   gr.UID,
				Name:                  gr.Name,
				Type:                  iType,
				Version:               iVersion,
				DisableResolveMessage: gr.DisableResolveMessage,
				Settings:              json.RawMessage(gr.Settings),
				SecureSettings:        gr.SecureSettings,
			})
		}
		receivers = append(receivers, &alertingNotify.APIReceiver{
			ConfigReceiver: r.Receiver,
			ReceiverConfig: models.ReceiverConfig{
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
		Alert: &models.TestReceiversConfigAlertParams{
			Annotations: v2.APILabelSetToModelLabelSet(a.Annotations),
			Labels:      v2.APILabelSetToModelLabelSet(a.Labels),
		},
		Receivers: receivers,
	})
}

func (am *alertmanager) TestIntegration(ctx context.Context, receiverName string, integrationConfig ngmodels.Integration, alert models.TestReceiversConfigAlertParams) (models.IntegrationStatus, error) {
	cfg, err := IntegrationToIntegrationConfig(integrationConfig)
	if err != nil {
		return models.IntegrationStatus{}, err
	}
	return am.Base.TestIntegration(ctx, receiverName, cfg, alert)
}

func (am *alertmanager) GetReceivers(_ context.Context) ([]models.ReceiverStatus, error) {
	return am.Base.GetReceiversStatus(), nil
}
