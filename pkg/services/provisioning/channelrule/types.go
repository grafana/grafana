package channelrule

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/provisioning/values"
)

// ConfigVersion is used to figure out which API version a config uses.
type configVersion struct {
	APIVersion int64 `json:"apiVersion" yaml:"apiVersion"`
}

type configs struct {
	APIVersion int64

	ChannelRules       []*upsertChannelRuleFromConfig
	DeleteChannelRules []*deleteChannelRuleConfig
}

type deleteChannelRuleConfig struct {
	OrgID   int64
	Pattern string
}

type upsertChannelRuleFromConfig struct {
	OrgID   int64
	Version int
	Pattern string
	Config  models.LiveChannelRulePlainConfig
	Secure  map[string]string
}

type configsV0 struct {
	configVersion

	ChannelRules       []*upsertChannelRuleFromConfigV0 `json:"channelRules" yaml:"channelRules"`
	DeleteChannelRules []*deleteChannelRuleConfigV0     `json:"deleteChannelRules" yaml:"deleteChannelRules"`
}

type deleteChannelRuleConfigV0 struct {
	OrgID   values.Int64Value  `json:"orgId" yaml:"orgId"`
	Pattern values.StringValue `json:"pattern" yaml:"pattern"`
}

type upsertChannelRuleFromConfigV0 struct {
	OrgID   values.Int64Value                 `json:"orgId" yaml:"orgId"`
	Version values.IntValue                   `json:"version" yaml:"version"`
	Pattern values.StringValue                `json:"pattern" yaml:"pattern"`
	Config  models.LiveChannelRulePlainConfig `json:"config" yaml:"config"`
	Secure  values.StringMapValue             `json:"secure" yaml:"secure"`
}

func (cfg *configsV0) mapToChannelRuleFromConfig(apiVersion int64) *configs {
	r := &configs{}

	r.APIVersion = apiVersion

	if cfg == nil {
		return r
	}

	for _, rule := range cfg.ChannelRules {
		r.ChannelRules = append(r.ChannelRules, &upsertChannelRuleFromConfig{
			OrgID:   rule.OrgID.Value(),
			Pattern: rule.Pattern.Value(),
			Version: rule.Version.Value(),
			Config:  rule.Config,
			Secure:  rule.Secure.Value(),
		})
	}

	for _, ds := range cfg.DeleteChannelRules {
		r.DeleteChannelRules = append(r.DeleteChannelRules, &deleteChannelRuleConfig{
			OrgID:   ds.OrgID.Value(),
			Pattern: ds.Pattern.Value(),
		})
	}

	return r
}

func createInsertCommand(ds *upsertChannelRuleFromConfig) models.CreateLiveChannelRuleCommand {
	return models.CreateLiveChannelRuleCommand{
		OrgId:   ds.OrgID,
		Pattern: ds.Pattern,
		Config:  ds.Config,
		Secure:  ds.Secure,
	}
}

func createUpdateCommand(ds *upsertChannelRuleFromConfig, id int64) models.UpdateLiveChannelRuleCommand {
	return models.UpdateLiveChannelRuleCommand{
		Id:      id,
		OrgId:   ds.OrgID,
		Pattern: ds.Pattern,
		Config:  ds.Config,
		Secure:  ds.Secure,
		Version: ds.Version,
	}
}
