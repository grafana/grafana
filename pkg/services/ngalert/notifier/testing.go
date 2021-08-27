package notifier

import (
	"context"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
)

type FakeConfigStore struct {
	configs map[int64]*models.AlertConfiguration
}

func (f *FakeConfigStore) GetLatestAlertmanagerConfiguration(query *models.GetLatestAlertmanagerConfigurationQuery) error {
	var ok bool
	query.Result, ok = f.configs[query.OrgID]
	if !ok {
		return store.ErrNoAlertmanagerConfiguration
	}

	return nil
}

func (f *FakeConfigStore) SaveAlertmanagerConfiguration(cmd *models.SaveAlertmanagerConfigurationCmd) error {
	f.configs[cmd.OrgID] = &models.AlertConfiguration{
		AlertmanagerConfiguration: cmd.AlertmanagerConfiguration,
		OrgID:                     cmd.OrgID,
		ConfigurationVersion:      "v1",
		Default:                   cmd.Default,
	}

	return nil
}

func (f *FakeConfigStore) SaveAlertmanagerConfigurationWithCallback(cmd *models.SaveAlertmanagerConfigurationCmd, callback store.SaveCallback) error {
	f.configs[cmd.OrgID] = &models.AlertConfiguration{
		AlertmanagerConfiguration: cmd.AlertmanagerConfiguration,
		OrgID:                     cmd.OrgID,
		ConfigurationVersion:      "v1",
		Default:                   cmd.Default,
	}

	if err := callback(); err != nil {
		return err
	}

	return nil
}

type FakeOrgStore struct {
	orgs []int64
}

func (f *FakeOrgStore) GetOrgs(_ context.Context) ([]int64, error) {
	return f.orgs, nil
}
