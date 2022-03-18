package services

import (
	"context"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
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
		}]
	}
}
`

type fakeAMConfigStore struct {
	config models.AlertConfiguration
}

func newFakeAMConfigStore() *fakeAMConfigStore {
	return &fakeAMConfigStore{
		config: models.AlertConfiguration{
			AlertmanagerConfiguration: defaultAlertmanagerConfigJSON,
			ConfigurationVersion:      "v1",
			Default:                   true,
			OrgID:                     1,
		},
	}
}

func (f *fakeAMConfigStore) GetLatestAlertmanagerConfiguration(ctx context.Context, query *models.GetLatestAlertmanagerConfigurationQuery) error {
	query.Result = &f.config
	query.Result.OrgID = query.OrgID
	return nil
}

func (f *fakeAMConfigStore) SaveAlertmanagerConfiguration(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error {
	f.config = models.AlertConfiguration{
		AlertmanagerConfiguration: cmd.AlertmanagerConfiguration,
		ConfigurationVersion:      cmd.ConfigurationVersion,
		Default:                   cmd.Default,
		OrgID:                     cmd.OrgID,
	}
	return nil
}

type fakeProvisioningStore struct{}

func (f *fakeProvisioningStore) GetProvenance(ctx context.Context, o models.Provisionable) (models.Provenance, error) {
	return models.ProvenanceNone, nil
}

func (f *fakeProvisioningStore) SetProvenance(ctx context.Context, o models.Provisionable, p models.Provenance) error {
	return nil
}
