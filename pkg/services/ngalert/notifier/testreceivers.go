package notifier

import (
	"context"

	"github.com/grafana/alerting/models"

	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

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
