package provisioning

import (
	"context"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	mock "github.com/stretchr/testify/mock"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
)

const defaultAlertmanagerConfigJSON = `
{
	"template_files": null,
	"alertmanager_config": {
		"route": {
			"receiver": "grafana-default-email",
			"group_by": [
				"..."
			],
			"routes": [{
				"receiver": "grafana-default-email",
				"object_matchers": [["a", "=", "b"]]
			}]
		},
		"templates": null,
		"receivers": [{
			"name": "grafana-default-email",
			"grafana_managed_receiver_configs": [{
				"uid": "UID1",
				"name": "grafana-default-email",
				"type": "email",
				"disableResolveMessage": false,
				"settings": {
					"addresses": "\u003cexample@email.com\u003e"
				},
				"secureFields": {}
			}]
		}, {
			"name": "slack receiver",
			"grafana_managed_receiver_configs": [{
				"uid": "UID2",
				"name": "slack receiver",
				"type": "slack",
				"disableResolveMessage": false,
				"settings": {},
				"secureSettings": {"url":"secure url"}
			}]
		}]
	}
}
`

type NopTransactionManager struct{}

func newNopTransactionManager() *NopTransactionManager {
	return &NopTransactionManager{}
}

func assertInTransaction(t *testing.T, ctx context.Context) {
	assert.Truef(t, ctx.Value(NopTransactionManager{}) != nil, "Expected to be executed in transaction but there is none")
}

func (n *NopTransactionManager) InTransaction(ctx context.Context, work func(ctx context.Context) error) error {
	return work(context.WithValue(ctx, NopTransactionManager{}, struct{}{}))
}

func (m *MockAMConfigStore_Expecter) GetsConfig(ac models.AlertConfiguration) *MockAMConfigStore_Expecter {
	m.GetLatestAlertmanagerConfiguration(mock.Anything, mock.Anything).Return(&ac, nil)
	return m
}

func (m *MockAMConfigStore_Expecter) SaveSucceeds() *MockAMConfigStore_Expecter {
	m.UpdateAlertmanagerConfiguration(mock.Anything, mock.Anything).Return(nil)
	return m
}

func (m *MockAMConfigStore_Expecter) SaveSucceedsIntercept(intercepted *models.SaveAlertmanagerConfigurationCmd) *MockAMConfigStore_Expecter {
	m.UpdateAlertmanagerConfiguration(mock.Anything, mock.Anything).
		Return(nil).
		Run(func(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) {
			*intercepted = *cmd
		})
	return m
}

func (m *MockProvisioningStore_Expecter) GetReturns(p models.Provenance) *MockProvisioningStore_Expecter {
	m.GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(p, nil)
	m.GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(nil, nil)
	return m
}

func (m *MockProvisioningStore_Expecter) SaveSucceeds() *MockProvisioningStore_Expecter {
	m.SetProvenance(mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)
	m.DeleteProvenance(mock.Anything, mock.Anything, mock.Anything).Return(nil)
	return m
}

func (m *MockQuotaChecker_Expecter) LimitOK() *MockQuotaChecker_Expecter {
	m.CheckQuotaReached(mock.Anything, mock.Anything, mock.Anything).Return(false, nil)
	return m
}

func (m *MockQuotaChecker_Expecter) LimitExceeded() *MockQuotaChecker_Expecter {
	m.CheckQuotaReached(mock.Anything, mock.Anything, mock.Anything).Return(true, nil)
	return m
}

type methodCall struct {
	Method string
	Args   []interface{}
}

type alertmanagerConfigStoreFake struct {
	Calls  []methodCall
	GetFn  func(ctx context.Context, orgID int64) (*cfgRevision, error)
	SaveFn func(ctx context.Context, revision *cfgRevision) error
}

func (a *alertmanagerConfigStoreFake) Get(ctx context.Context, orgID int64) (*cfgRevision, error) {
	a.Calls = append(a.Calls, methodCall{
		Method: "Get",
		Args:   []interface{}{ctx, orgID},
	})
	if a.GetFn != nil {
		return a.GetFn(ctx, orgID)
	}
	return nil, nil
}

func (a *alertmanagerConfigStoreFake) Save(ctx context.Context, revision *cfgRevision, orgID int64) error {
	a.Calls = append(a.Calls, methodCall{
		Method: "Save",
		Args:   []interface{}{ctx, revision, orgID},
	})
	if a.SaveFn != nil {
		return a.SaveFn(ctx, revision)
	}
	return nil
}

type NotificationSettingsValidatorProviderFake struct {
}

func (n *NotificationSettingsValidatorProviderFake) Validator(ctx context.Context, orgID int64) (notifier.NotificationSettingsValidator, error) {
	return notifier.NoValidation{}, nil
}

type call struct {
	Method string
	Args   []interface{}
}

type fakeRuleAccessControlService struct {
	mu                             sync.Mutex
	Calls                          []call
	AuthorizeAccessToRuleGroupFunc func(ctx context.Context, user identity.Requester, rules models.RulesGroup) error
	AuthorizeAccessInFolderFunc    func(ctx context.Context, user identity.Requester, namespaced models.Namespaced) error
	AuthorizeRuleChangesFunc       func(ctx context.Context, user identity.Requester, change *store.GroupDelta) error
	CanReadAllRulesFunc            func(ctx context.Context, user identity.Requester) (bool, error)
	CanWriteAllRulesFunc           func(ctx context.Context, user identity.Requester) (bool, error)
}

func (s *fakeRuleAccessControlService) RecordCall(method string, args ...interface{}) {
	s.mu.Lock()
	defer s.mu.Unlock()

	call := call{
		Method: method,
		Args:   args,
	}

	s.Calls = append(s.Calls, call)
}

func (s *fakeRuleAccessControlService) AuthorizeRuleGroupRead(ctx context.Context, user identity.Requester, rules models.RulesGroup) error {
	s.RecordCall("AuthorizeRuleGroupRead", ctx, user, rules)
	if s.AuthorizeAccessToRuleGroupFunc != nil {
		return s.AuthorizeAccessToRuleGroupFunc(ctx, user, rules)
	}
	return nil
}

func (s *fakeRuleAccessControlService) AuthorizeRuleRead(ctx context.Context, user identity.Requester, rule *models.AlertRule) error {
	s.RecordCall("AuthorizeRuleRead", ctx, user, rule)
	if s.AuthorizeAccessInFolderFunc != nil {
		return s.AuthorizeAccessInFolderFunc(ctx, user, rule)
	}
	return nil
}

func (s *fakeRuleAccessControlService) AuthorizeRuleGroupWrite(ctx context.Context, user identity.Requester, change *store.GroupDelta) error {
	s.RecordCall("AuthorizeRuleGroupWrite", ctx, user, change)
	if s.AuthorizeRuleChangesFunc != nil {
		return s.AuthorizeRuleChangesFunc(ctx, user, change)
	}
	return nil
}

func (s *fakeRuleAccessControlService) CanReadAllRules(ctx context.Context, user identity.Requester) (bool, error) {
	s.RecordCall("CanReadAllRules", ctx, user)
	if s.CanReadAllRulesFunc != nil {
		return s.CanReadAllRulesFunc(ctx, user)
	}
	return false, nil
}

func (s *fakeRuleAccessControlService) CanWriteAllRules(ctx context.Context, user identity.Requester) (bool, error) {
	s.RecordCall("CanWriteAllRules", ctx, user)
	if s.CanWriteAllRulesFunc != nil {
		return s.CanWriteAllRulesFunc(ctx, user)
	}
	return false, nil
}

type fakeAlertRuleNotificationStore struct {
	Calls []call

	RenameReceiverInNotificationSettingsFn func(ctx context.Context, orgID int64, oldReceiver, newReceiver string) (int, error)
	ListNotificationSettingsFn             func(ctx context.Context, q models.ListNotificationSettingsQuery) (map[models.AlertRuleKey][]models.NotificationSettings, error)
}

func (f *fakeAlertRuleNotificationStore) RenameReceiverInNotificationSettings(ctx context.Context, orgID int64, oldReceiver, newReceiver string) (int, error) {
	call := call{
		Method: "RenameReceiverInNotificationSettings",
		Args:   []interface{}{ctx, orgID, oldReceiver, newReceiver},
	}
	f.Calls = append(f.Calls, call)

	if f.RenameReceiverInNotificationSettingsFn != nil {
		return f.RenameReceiverInNotificationSettingsFn(ctx, orgID, oldReceiver, newReceiver)
	}

	// Default values when no function hook is provided
	return 0, nil
}

func (f *fakeAlertRuleNotificationStore) ListNotificationSettings(ctx context.Context, q models.ListNotificationSettingsQuery) (map[models.AlertRuleKey][]models.NotificationSettings, error) {
	call := call{
		Method: "ListNotificationSettings",
		Args:   []interface{}{ctx, q},
	}
	f.Calls = append(f.Calls, call)

	if f.ListNotificationSettingsFn != nil {
		return f.ListNotificationSettingsFn(ctx, q)
	}

	// Default values when no function hook is provided
	return nil, nil
}
