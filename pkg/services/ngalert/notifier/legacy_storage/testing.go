package legacy_storage

import (
	"context"

	"github.com/stretchr/testify/mock"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

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

type methodCall struct {
	Method string
	Args   []interface{}
}

type AlertmanagerConfigStoreFake struct {
	Calls  []methodCall
	GetFn  func(ctx context.Context, orgID int64) (*ConfigRevision, error)
	SaveFn func(ctx context.Context, revision *ConfigRevision) error
}

func (a *AlertmanagerConfigStoreFake) Get(ctx context.Context, orgID int64) (*ConfigRevision, error) {
	a.Calls = append(a.Calls, methodCall{
		Method: "Get",
		Args:   []interface{}{ctx, orgID},
	})
	if a.GetFn != nil {
		return a.GetFn(ctx, orgID)
	}
	return nil, nil
}

func (a *AlertmanagerConfigStoreFake) Save(ctx context.Context, revision *ConfigRevision, orgID int64) error {
	a.Calls = append(a.Calls, methodCall{
		Method: "Save",
		Args:   []interface{}{ctx, revision, orgID},
	})
	if a.SaveFn != nil {
		return a.SaveFn(ctx, revision)
	}
	return nil
}
