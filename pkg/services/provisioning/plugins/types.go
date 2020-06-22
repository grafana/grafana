package plugins

import "github.com/grafana/grafana/pkg/services/provisioning/values"

// pluginsAsConfig is a normalized data object for plugins config data. Any config version should be mappable.
// to this type.
type pluginsAsConfig struct {
	Apps []*appFromConfig
}

type appFromConfig struct {
	OrgID          int64
	OrgName        string
	PluginID       string
	Enabled        bool
	Pinned         bool
	PluginVersion  string
	JSONData       map[string]interface{}
	SecureJSONData map[string]string
}

type appFromConfigV0 struct {
	OrgID          values.Int64Value     `json:"org_id" yaml:"org_id"`
	OrgName        values.StringValue    `json:"org_name" yaml:"org_name"`
	Type           values.StringValue    `json:"type" yaml:"type"`
	Disabled       values.BoolValue      `json:"disabled" yaml:"disabled"`
	JSONData       values.JSONValue      `json:"jsonData" yaml:"jsonData"`
	SecureJSONData values.StringMapValue `json:"secureJsonData" yaml:"secureJsonData"`
}

// pluginsAsConfigV0 is a mapping for zero version configs. This is mapped to its normalised version.
type pluginsAsConfigV0 struct {
	Apps []*appFromConfigV0 `json:"apps" yaml:"apps"`
}

// mapToPluginsFromConfig maps config syntax to a normalized notificationsAsConfig object. Every version
// of the config syntax should have this function.
func (cfg *pluginsAsConfigV0) mapToPluginsFromConfig() *pluginsAsConfig {
	r := &pluginsAsConfig{}
	if cfg == nil {
		return r
	}

	for _, app := range cfg.Apps {
		r.Apps = append(r.Apps, &appFromConfig{
			OrgID:          app.OrgID.Value(),
			OrgName:        app.OrgName.Value(),
			PluginID:       app.Type.Value(),
			Enabled:        !app.Disabled.Value(),
			Pinned:         true,
			JSONData:       app.JSONData.Value(),
			SecureJSONData: app.SecureJSONData.Value(),
		})
	}

	return r
}
