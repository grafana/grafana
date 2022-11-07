package provisioning

import (
	"context"
	"crypto/md5"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	mock "github.com/stretchr/testify/mock"
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
				"uid": "",
				"name": "email receiver",
				"type": "email",
				"disableResolveMessage": false,
				"settings": {
					"addresses": "\u003cexample@email.com\u003e"
				},
				"secureFields": {}
			}]
		}, {
			"name": "a new receiver",
			"grafana_managed_receiver_configs": [{
				"uid": "",
				"name": "email receiver",
				"type": "email",
				"disableResolveMessage": false,
				"settings": {
					"addresses": "\u003canother@email.com\u003e"
				},
				"secureFields": {}
			}]
		}]
	}
}
`

type fakeAMConfigStore struct {
	config          models.AlertConfiguration
	lastSaveCommand *models.SaveAlertmanagerConfigurationCmd
}

func newFakeAMConfigStore() *fakeAMConfigStore {
	return &fakeAMConfigStore{
		config: models.AlertConfiguration{
			AlertmanagerConfiguration: defaultAlertmanagerConfigJSON,
			ConfigurationVersion:      "v1",
			Default:                   true,
			OrgID:                     1,
		},
		lastSaveCommand: nil,
	}
}

func (f *fakeAMConfigStore) GetLatestAlertmanagerConfiguration(ctx context.Context, query *models.GetLatestAlertmanagerConfigurationQuery) error {
	query.Result = &f.config
	query.Result.OrgID = query.OrgID
	query.Result.ConfigurationHash = fmt.Sprintf("%x", md5.Sum([]byte(f.config.AlertmanagerConfiguration)))
	return nil
}

func (f *fakeAMConfigStore) UpdateAlertmanagerConfiguration(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error {
	f.config = models.AlertConfiguration{
		AlertmanagerConfiguration: cmd.AlertmanagerConfiguration,
		ConfigurationVersion:      cmd.ConfigurationVersion,
		Default:                   cmd.Default,
		OrgID:                     cmd.OrgID,
	}
	f.lastSaveCommand = cmd
	return nil
}

type fakeProvisioningStore struct {
	records map[int64]map[string]models.Provenance
}

func NewFakeProvisioningStore() *fakeProvisioningStore {
	return &fakeProvisioningStore{
		records: map[int64]map[string]models.Provenance{},
	}
}

func (f *fakeProvisioningStore) GetProvenance(ctx context.Context, o models.Provisionable, org int64) (models.Provenance, error) {
	if val, ok := f.records[org]; ok {
		if prov, ok := val[o.ResourceID()+o.ResourceType()]; ok {
			return prov, nil
		}
	}
	return models.ProvenanceNone, nil
}

func (f *fakeProvisioningStore) GetProvenances(ctx context.Context, orgID int64, resourceType string) (map[string]models.Provenance, error) {
	results := make(map[string]models.Provenance)
	if val, ok := f.records[orgID]; ok {
		for k, v := range val {
			if strings.HasSuffix(k, resourceType) {
				results[strings.TrimSuffix(k, resourceType)] = v
			}
		}
	}
	return results, nil
}

func (f *fakeProvisioningStore) SetProvenance(ctx context.Context, o models.Provisionable, org int64, p models.Provenance) error {
	if _, ok := f.records[org]; !ok {
		f.records[org] = map[string]models.Provenance{}
	}
	_ = f.DeleteProvenance(ctx, o, org) // delete old entries first
	f.records[org][o.ResourceID()+o.ResourceType()] = p
	return nil
}

func (f *fakeProvisioningStore) DeleteProvenance(ctx context.Context, o models.Provisionable, org int64) error {
	if val, ok := f.records[org]; ok {
		delete(val, o.ResourceID()+o.ResourceType())
	}
	return nil
}

type NopTransactionManager struct{}

func newNopTransactionManager() *NopTransactionManager {
	return &NopTransactionManager{}
}

func (n *NopTransactionManager) InTransaction(ctx context.Context, work func(ctx context.Context) error) error {
	return work(ctx)
}

func (m *MockAMConfigStore_Expecter) GetsConfig(ac models.AlertConfiguration) *MockAMConfigStore_Expecter {
	m.GetLatestAlertmanagerConfiguration(mock.Anything, mock.Anything).
		Run(func(ctx context.Context, q *models.GetLatestAlertmanagerConfigurationQuery) {
			q.Result = &ac
		}).
		Return(nil)
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
