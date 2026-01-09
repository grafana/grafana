package notifier

import (
	"context"
	"fmt"
	"slices"

	alertingModels "github.com/grafana/alerting/models"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type AlertmanagerProvider interface {
	AlertmanagerFor(orgID int64) (Alertmanager, error)
}

type ReceiverGetter interface {
	GetReceiver(ctx context.Context, uid string, decrypt bool, user identity.Requester) (*models.Receiver, error)
}

func NewReceiverTestingSvc(receiverSvc *ReceiverService, amProvider AlertmanagerProvider, encryptionService secretService) *ReceiverTestingSvc {
	return &ReceiverTestingSvc{
		receiverSvc:       receiverSvc,
		amProvider:        amProvider,
		encryptionService: encryptionService,
	}
}

type ReceiverTestingSvc struct {
	receiverSvc       ReceiverGetter
	amProvider        AlertmanagerProvider
	encryptionService secretService
}

type Alert struct {
	Labels      map[string]string
	Annotations map[string]string
}

type IntegrationTestResult alertingModels.IntegrationStatus

func (t *ReceiverTestingSvc) Test(ctx context.Context, user identity.Requester, alert Alert, receiverUID string, integration models.Integration, requiredSecrets []string) (IntegrationTestResult, error) {
	alertParam, err := convertToAlertParam(alert)
	if err != nil {
		return IntegrationTestResult{}, err
	}
	decryptedPatchedIntegration, err := t.patchSecrets(ctx, user, receiverUID, integration, requiredSecrets)
	if err != nil {
		return IntegrationTestResult{}, err
	}
	err = decryptedPatchedIntegration.Validate(DecryptIntegrationSettings(ctx, t.encryptionService))
	if err != nil {
		return IntegrationTestResult{}, err
	}
	am, err := t.amProvider.AlertmanagerFor(user.GetOrgID())
	if err != nil {
		return IntegrationTestResult{}, err
	}
	result, err := am.TestIntegration(ctx, "test-receiver", decryptedPatchedIntegration, alertParam)
	return IntegrationTestResult(result), err
}

func (t *ReceiverTestingSvc) patchSecrets(ctx context.Context, user identity.Requester, receiverUID string, integration models.Integration, secrets []string) (models.Integration, error) {
	if len(secrets) == 0 {
		return integration, nil
	}
	if integration.UID == "" || receiverUID == "" {
		return integration, fmt.Errorf("cannot patch secrets for integration without receiver or integration UID")
	}
	rcv, err := t.receiverSvc.GetReceiver(ctx, receiverUID, false, user)
	if err != nil {
		return integration, err
	}
	if rcv == nil {
		return integration, fmt.Errorf("cannot patch secrets for receiver that does not exist")
	}
	idx := slices.IndexFunc(rcv.Integrations, func(i *models.Integration) bool {
		return i.UID == integration.UID
	})
	if idx < 0 {
		return integration, fmt.Errorf("cannot patch secrets for integration that does not exist")
	}
	integration.WithExistingSecureFields(rcv.Integrations[idx], secrets)

	err = integration.Decrypt(DecryptIntegrationSettings(ctx, t.encryptionService))
	if err != nil {
		return integration, err
	}
	return integration, nil
}

func convertToAlertParam(alert Alert) (alertingModels.TestReceiversConfigAlertParams, error) {
	alertParam := alertingModels.TestReceiversConfigAlertParams{
		Annotations: make(model.LabelSet, len(alert.Annotations)),
		Labels:      make(model.LabelSet, len(alert.Labels)),
	}
	for k, v := range alert.Annotations {
		alertParam.Annotations[model.LabelName(k)] = model.LabelValue(v)
	}
	for k, v := range alert.Labels {
		alertParam.Labels[model.LabelName(k)] = model.LabelValue(v)
	}
	if err := alertParam.Annotations.Validate(); err != nil {
		return alertingModels.TestReceiversConfigAlertParams{}, fmt.Errorf("invalid annotations: %w", err)
	}
	if err := alertParam.Labels.Validate(); err != nil {
		return alertingModels.TestReceiversConfigAlertParams{}, fmt.Errorf("invalid labels: %w", err)
	}
	return alertParam, nil
}
