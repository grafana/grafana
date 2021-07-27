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
	OrgID          int64
	Version        int
	Pattern        string
	Settings       models.LiveChannelRuleSettings
	SecureSettings map[string]string
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
	OrgID          values.Int64Value              `json:"orgId" yaml:"orgId"`
	Version        values.IntValue                `json:"version" yaml:"version"`
	Pattern        values.StringValue             `json:"pattern" yaml:"pattern"`
	Settings       models.LiveChannelRuleSettings `json:"settings" yaml:"settings"`
	SecureSettings values.StringMapValue          `json:"secureSettings" yaml:"secureSettings"`
}

func (cfg *configsV0) mapToChannelRuleFromConfig(apiVersion int64) *configs {
	r := &configs{}

	r.APIVersion = apiVersion

	if cfg == nil {
		return r
	}

	for _, rule := range cfg.ChannelRules {
		r.ChannelRules = append(r.ChannelRules, &upsertChannelRuleFromConfig{
			OrgID:          rule.OrgID.Value(),
			Pattern:        rule.Pattern.Value(),
			Version:        rule.Version.Value(),
			Settings:       rule.Settings,
			SecureSettings: rule.SecureSettings.Value(),
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
		OrgId:          ds.OrgID,
		Pattern:        ds.Pattern,
		Settings:       ds.Settings,
		SecureSettings: ds.SecureSettings,
	}
}

func createUpdateCommand(ds *upsertChannelRuleFromConfig, uid string) models.UpdateLiveChannelRuleCommand {
	return models.UpdateLiveChannelRuleCommand{
		Uid:            uid,
		OrgId:          ds.OrgID,
		Pattern:        ds.Pattern,
		Settings:       ds.Settings,
		SecureSettings: ds.SecureSettings,
		Version:        ds.Version,
	}
}
