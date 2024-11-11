package orgs

import (
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/provisioning/values"
)

type configs struct {
	APIVersion int64

	Orgs       []*upsertOrgConfig
	DeleteOrgs []*deleteOrgsConfig
}

type upsertOrgConfig struct {
	ID   int64
	Name string
}

type deleteOrgsConfig struct {
	ID   int64
	Name string
}

// ConfigVersion is used to figure out which API version a config uses.
type configVersion struct {
	APIVersion int64 `json:"apiVersion" yaml:"apiVersion"`
}

type configsV1 struct {
	configVersion
	log log.Logger

	Orgs       []*upsertOrgFromConfigV1  `json:"orgs" yaml:"orgs"`
	DeleteOrgs []*deleteOrgsFromConfigV1 `json:"deleteOrgs" yaml:"deleteOrgs"`
}

type upsertOrgFromConfigV1 struct {
	ID   values.Int64Value  `json:"id" yaml:"id"`
	Name values.StringValue `json:"name" yaml:"name"`
}

type deleteOrgsFromConfigV1 struct {
	ID values.Int64Value `json:"id" yaml:"id"`
}

func (cfg *configsV1) mapToOrgsFromConfig(apiVersion int64) *configs {
	r := &configs{}

	r.APIVersion = apiVersion

	if cfg == nil {
		return r
	}

	for _, org := range cfg.Orgs {
		r.Orgs = append(r.Orgs, &upsertOrgConfig{
			ID:   org.ID.Value(),
			Name: org.Name.Value(),
		})
	}

	for _, org := range cfg.DeleteOrgs {
		r.DeleteOrgs = append(r.DeleteOrgs, &deleteOrgsConfig{
			ID: org.ID.Value(),
		})
	}

	return r
}
