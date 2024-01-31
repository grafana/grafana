package fakes

import (
	"context"
	"crypto/md5"
	"fmt"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type FakeAlertmanagerConfigStore struct {
	Config          models.AlertConfiguration
	LastSaveCommand *models.SaveAlertmanagerConfigurationCmd
}

func NewFakeAlertmanagerConfigStore(config string) *FakeAlertmanagerConfigStore {
	return &FakeAlertmanagerConfigStore{
		Config: models.AlertConfiguration{
			AlertmanagerConfiguration: config,
			ConfigurationVersion:      "v1",
			Default:                   true,
			OrgID:                     1,
		},
		LastSaveCommand: nil,
	}
}

func (f *FakeAlertmanagerConfigStore) GetLatestAlertmanagerConfiguration(ctx context.Context, orgID int64) (*models.AlertConfiguration, error) {
	result := &f.Config
	result.OrgID = orgID
	result.ConfigurationHash = fmt.Sprintf("%x", md5.Sum([]byte(f.Config.AlertmanagerConfiguration)))
	return result, nil
}

func (f *FakeAlertmanagerConfigStore) UpdateAlertmanagerConfiguration(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error {
	f.Config = models.AlertConfiguration{
		AlertmanagerConfiguration: cmd.AlertmanagerConfiguration,
		ConfigurationVersion:      cmd.ConfigurationVersion,
		Default:                   cmd.Default,
		OrgID:                     cmd.OrgID,
	}
	f.LastSaveCommand = cmd
	return nil
}
