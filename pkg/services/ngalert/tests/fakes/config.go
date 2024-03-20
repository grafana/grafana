package fakes

import (
	"context"
	"crypto/md5"
	"fmt"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type FakeAlertmanagerConfigStore struct {
	Config models.AlertConfiguration
	// GetFn is an optional function that can be set to mock the GetLatestAlertmanagerConfiguration method
	GetFn func(ctx context.Context, orgID int64) (*models.AlertConfiguration, error)
	// UpdateFn is an optional function that can be set to mock the UpdateAlertmanagerConfiguration method
	UpdateFn func(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error
	// LastSaveCommand is the last command that was passed to UpdateAlertmanagerConfiguration
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
	if f.GetFn != nil {
		return f.GetFn(ctx, orgID)
	}

	result := &f.Config
	result.OrgID = orgID
	result.ConfigurationHash = fmt.Sprintf("%x", md5.Sum([]byte(f.Config.AlertmanagerConfiguration)))
	result.ConfigurationVersion = f.Config.ConfigurationVersion
	return result, nil
}

func (f *FakeAlertmanagerConfigStore) UpdateAlertmanagerConfiguration(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error {
	if f.UpdateFn != nil {
		return f.UpdateFn(ctx, cmd)
	}

	f.Config = models.AlertConfiguration{
		AlertmanagerConfiguration: cmd.AlertmanagerConfiguration,
		ConfigurationVersion:      cmd.ConfigurationVersion,
		Default:                   cmd.Default,
		OrgID:                     cmd.OrgID,
	}
	f.LastSaveCommand = cmd
	return nil
}
