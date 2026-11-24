package notifier

import (
	"context"
	"fmt"
	"strings"

	alertingModels "github.com/grafana/alerting/models"
	"github.com/grafana/alerting/receivers/schema"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// receiverAccessControlService provides access control for receivers.
type receiverTestingAccessControlService interface {
	HasUpdateProtected(context.Context, identity.Requester, *models.Receiver) (bool, error)
	AuthorizeUpdateProtected(context.Context, identity.Requester, *models.Receiver) error
	AuthorizeTest(context.Context, identity.Requester, *models.Receiver) error
	AuthorizeTestNew(context.Context, identity.Requester) error
}

type AlertmanagerProvider interface {
	AlertmanagerFor(orgID int64) (Alertmanager, error)
}

type ReceiverGetter interface {
	GetReceiver(ctx context.Context, uid string, decrypt bool, user identity.Requester) (*models.Receiver, error)
}

func NewReceiverTestingService(
	receiverSvc *ReceiverService,
	amProvider AlertmanagerProvider,
	encryptionService secretService,
	authz receiverTestingAccessControlService,
	allowedIntegrations map[schema.IntegrationType]struct{},
	emailValidator EmailIntegrationValidator,
) *ReceiverTestingService {
	return &ReceiverTestingService{
		receiverSvc:         receiverSvc,
		amProvider:          amProvider,
		encryptionService:   encryptionService,
		authz:               authz,
		allowedIntegrations: allowedIntegrations,
		emailValidator:      emailValidator,
	}
}

type ReceiverTestingService struct {
	receiverSvc         ReceiverGetter
	amProvider          AlertmanagerProvider
	encryptionService   secretService
	authz               receiverTestingAccessControlService
	allowedIntegrations map[schema.IntegrationType]struct{}
	emailValidator      EmailIntegrationValidator
}

type Alert struct {
	Labels      map[string]string
	Annotations map[string]string
}

type IntegrationTestResult alertingModels.IntegrationStatus

// TestNewReceiverIntegration tests a new integration for a receiver (new or existing) and returns the test result or an error.
// If receiver UID is provided, the user must be authorized to update and test the receiver.
// If UID is not provided, the user must be authorized to create new receivers.
func (t *ReceiverTestingService) TestNewReceiverIntegration(ctx context.Context, user identity.Requester, alert Alert, integration models.Integration) (IntegrationTestResult, error) {
	if integration.UID != "" {
		return IntegrationTestResult{}, models.ErrReceiverTestingInvalidIntegration("integration UID must be empty")
	}
	// Creator can test its own receivers
	err := t.authz.AuthorizeTestNew(ctx, user)
	if err != nil {
		return IntegrationTestResult{}, err
	}
	return t.testIntegration(ctx, user, alert, nil, integration)
}

// PatchIntegrationAndTest patches integration with the secrets from an existing integration and tests it.
// User must be authorized to update and test the receiver. If integration has protected fields, the user must be authorized to update them.
func (t *ReceiverTestingService) PatchIntegrationAndTest(ctx context.Context, user identity.Requester, alert Alert, receiverUID string, integration models.Integration, requiredSecrets []string) (IntegrationTestResult, error) {
	if receiverUID == "" {
		return IntegrationTestResult{}, models.ErrReceiverTestingInvalidIntegration("receiver UID is required")
	}
	if integration.UID == "" && len(requiredSecrets) > 0 {
		return IntegrationTestResult{}, models.ErrReceiverTestingInvalidIntegration("integration UID must be set when patching secrets")
	}
	// if it's existing receiver and user submitted settings, check if the user has permissions to update
	err := t.authz.AuthorizeTest(ctx, user, &models.Receiver{UID: receiverUID})
	if err != nil {
		return IntegrationTestResult{}, err
	}

	rcv, err := t.receiverSvc.GetReceiver(ctx, receiverUID, false, user)
	if err != nil {
		return IntegrationTestResult{}, err
	}

	i := integration
	if i.UID != "" {
		// if need patching, get the integration
		existing := rcv.GetIntegrationByUID(integration.UID)
		if existing == nil {
			return IntegrationTestResult{}, models.ErrReceiverTestingIntegrationNotFound.Errorf("")
		}
		// Protected fields are checked against the schema the request declares.
		// Different versions might protect different fields, so the version must match the stored one.
		if integration.Config.Version != existing.Config.Version {
			return IntegrationTestResult{}, models.ErrReceiverTestingInvalidIntegration(
				fmt.Sprintf("integration version cannot be changed when testing an existing integration: stored %s, requested %s",
					existing.Config.Version, integration.Config.Version),
			)
		}
		// Secrets are copied by field name, so they must not move to another type.
		if len(requiredSecrets) > 0 && integration.Config.Type() != existing.Config.Type() {
			return IntegrationTestResult{}, models.ErrReceiverTestingInvalidIntegration(
				fmt.Sprintf("stored secrets cannot be used when changing the integration type from %s to %s",
					existing.Config.Type(), integration.Config.Type()),
			)
		}
		if len(requiredSecrets) > 0 {
			i = integration.Clone()
			i.WithExistingSecureFields(existing, requiredSecrets)
		}
		err = t.authorizeEdits(ctx, user, rcv, &i, existing)
		if err != nil {
			return IntegrationTestResult{}, err
		}
	}
	result, err := t.testIntegration(ctx, user, alert, rcv, i)
	if len(i.SecureSettings) > 0 {
		result.LastNotifyAttemptError = t.redactSecrets(ctx, i, result.LastNotifyAttemptError)
	}
	return result, err
}

// redactSecrets removes the decrypted secure settings from a notifier error message.
// Notifiers can echo credentials in their errors, and the error is returned to the caller.
func (t *ReceiverTestingService) redactSecrets(ctx context.Context, integration models.Integration, msg string) string {
	if msg == "" {
		return msg
	}
	decryptFn := DecryptIntegrationSettings(ctx, t.encryptionService)
	for _, encrypted := range integration.SecureSettings {
		secret, err := decryptFn(encrypted)
		if err != nil || secret == "" {
			continue
		}
		msg = strings.ReplaceAll(msg, secret, "[REDACTED]")
	}
	return msg
}

func (t *ReceiverTestingService) authorizeEdits(ctx context.Context, user identity.Requester, rcv *models.Receiver, integration, existing *models.Integration) error {
	// if user does not have permissions to update protected, check the diff and return error if there is a change in protected fields
	canUpdateProtected, _ := t.authz.HasUpdateProtected(ctx, user, rcv)
	if canUpdateProtected {
		return nil
	}
	diff := models.HasIntegrationsDifferentProtectedFields(existing, integration)
	if len(diff) == 0 {
		return nil
	}
	err := t.authz.AuthorizeUpdateProtected(ctx, user, rcv)
	if err != nil {
		return makeProtectedFieldsAuthzError(err, map[string][]schema.IntegrationFieldPath{
			existing.UID: diff,
		})
	}
	return nil
}

func (t *ReceiverTestingService) testIntegration(ctx context.Context, user identity.Requester, alert Alert, receiver *models.Receiver, integration models.Integration) (IntegrationTestResult, error) {
	if t.allowedIntegrations != nil {
		iType := integration.Config.Type()
		if _, allowed := t.allowedIntegrations[iType]; !allowed {
			return IntegrationTestResult{}, models.ErrReceiverTestingInvalidIntegration(
				fmt.Sprintf("integration type %s is not allowed", iType),
			)
		}
	}
	alertParam, err := convertToAlertParam(alert)
	if err != nil {
		return IntegrationTestResult{}, models.ErrReceiverTestingInvalidIntegration(err.Error())
	}
	decryptFn := DecryptIntegrationSettings(ctx, t.encryptionService)
	err = integration.Validate(decryptFn)
	if err != nil {
		return IntegrationTestResult{}, models.ErrReceiverInvalid(err)
	}
	orgID := user.GetOrgID()
	if integration.Config.Type() == schema.EmailType {
		if err := t.emailValidator.ValidateIntegration(ctx, orgID, integration, decryptFn, log.New("ngalert", "component", "integration-testing").FromContext(ctx)); err != nil {
			return IntegrationTestResult{}, models.ErrReceiverInvalid(err)
		}
	}
	am, err := t.amProvider.AlertmanagerFor(orgID)
	if err != nil {
		return IntegrationTestResult{}, err
	}
	rcvName := "test-receiver"
	if receiver != nil {
		rcvName = receiver.Name
	}
	result, err := am.TestIntegration(ctx, rcvName, integration, alertParam)
	return IntegrationTestResult(result), err
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
