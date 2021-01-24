package orgs

import (
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/provisioning/values"
)

// ConfigVersion is used to figure out which API version a config uses.
type configVersion struct {
	APIVersion int64 `json:"apiVersion" yaml:"apiVersion"`
}

type configs struct {
	APIVersion int64

	Orgs       []*upsertOrgFromConfig
	DeleteOrgs []*deleteOrgConfig
}

type deleteOrgConfig struct {
	Id   int64
	Name string
}

type upsertOrgFromConfig struct {
	Id          int64
	Name        string
	Preferences *upsertOrgPreferences
}

type upsertOrgPreferences struct {
	HomeDashboardId int64
	Timezone        string
	Theme           string
}

type configsV1 struct {
	configVersion
	log log.Logger

	Orgs       []*upsertOrgFromConfigV1 `json:"orgs" yaml:"orgs"`
	DeleteOrgs []*deleteOrgConfigV1     `json:"deleteOrgs" yaml:"deleteOrgs"`
}

type deleteOrgConfigV1 struct {
	Id values.Int64Value `json:"id" yaml:"id"`
}

type upsertOrgFromConfigV1 struct {
	Id          values.Int64Value       `json:"id" yaml:"id"`
	Name        values.StringValue      `json:"name" yaml:"name"`
	Preferences *upsertOrgPreferencesV1 `json:"preferences" yaml:"preferences"`
}

type upsertOrgPreferencesV1 struct {
	HomeDashboardId values.Int64Value  `json:"homeDashboardId" yaml:"homeDashboardId"`
	Timezone        values.StringValue `json:"timezone" yaml:"timezone"`
	Theme           values.StringValue `json:"theme" yaml:"theme"`
}

func (cfg *configsV1) mapToOrgFromConfig(apiVersion int64) *configs {
	r := &configs{}

	r.APIVersion = apiVersion

	if cfg == nil {
		return r
	}

	for _, org := range cfg.Orgs {
		upsertCfg := &upsertOrgFromConfig{
			Id:   org.Id.Value(),
			Name: org.Name.Value(),
		}

		if org.Preferences != nil {
			upsertCfg.Preferences = &upsertOrgPreferences{
				HomeDashboardId: org.Preferences.HomeDashboardId.Value(),
				Timezone:        org.Preferences.Timezone.Value(),
				Theme:           org.Preferences.Theme.Value(),
			}
		}

		r.Orgs = append(r.Orgs, upsertCfg)
	}

	for _, org := range cfg.DeleteOrgs {
		r.DeleteOrgs = append(r.DeleteOrgs, &deleteOrgConfig{
			Id: org.Id.Value(),
		})
	}

	return r
}

func createInsertCommand(org *upsertOrgFromConfig) *models.CreateOrgCommand {
	return &models.CreateOrgCommand{
		Id:   org.Id,
		Name: org.Name,
	}
}

func createUpdateCommand(org *upsertOrgFromConfig) *models.UpdateOrgCommand {
	return &models.UpdateOrgCommand{
		OrgId: org.Id,
		Name:  org.Name,
	}
}

func createSavePreferencesCommand(org *upsertOrgFromConfig) *models.SavePreferencesCommand {
	if org.Preferences == nil {
		return nil
	}

	return &models.SavePreferencesCommand{
		OrgId:           org.Id,
		HomeDashboardId: org.Preferences.HomeDashboardId,
		Timezone:        org.Preferences.Timezone,
		Theme:           org.Preferences.Theme,
	}
}
