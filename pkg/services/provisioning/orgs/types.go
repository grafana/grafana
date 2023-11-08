package orgs

import "github.com/grafana/grafana/pkg/services/provisioning/values"

type configVersion struct {
	APIVersion int64 `json:"apiVersion" yaml:"apiVersion"`
}

type orgFile struct {
	configVersion

	CreateOrgs []*orgFromConfig
	DeleteOrgs []*deleteOrgConfig
}

type orgFromConfig struct {
	Name                     string
	InitialAdminLoginOrEmail string
}

type deleteOrgConfig struct {
	Name string
}

type orgFileV1 struct {
	configVersion

	CreateOrgs []*orgFromConfigV1   `json:"orgs" yaml:"orgs"`
	DeleteOrgs []*deleteOrgConfigV1 `json:"deleteOrgs" yaml:"deleteOrgs"`
}

type orgFromConfigV1 struct {
	Name                     values.StringValue `json:"name" yaml:"name"`
	InitialAdminLoginOrEmail values.StringValue `json:"initialAdminLoginOrEmail" yaml:"initialAdminLoginOrEmail"`
}

type deleteOrgConfigV1 struct {
	Name values.StringValue `json:"name" yaml:"name"`
}

func (cfg *orgFileV1) mapToModel() orgFile {
	r := orgFile{}
	if cfg == nil {
		return r
	}

	for _, createOrg := range cfg.CreateOrgs {
		r.CreateOrgs = append(r.CreateOrgs, &orgFromConfig{
			Name:                     createOrg.Name.Value(),
			InitialAdminLoginOrEmail: createOrg.InitialAdminLoginOrEmail.Value(),
		})
	}

	for _, deleteOrg := range cfg.DeleteOrgs {
		r.DeleteOrgs = append(r.DeleteOrgs, &deleteOrgConfig{
			Name: deleteOrg.Name.Value(),
		})
	}

	return r
}
