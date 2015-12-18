package plugins

type DataSourcePlugin struct {
	Type               string                 `json:"type"`
	Name               string                 `json:"name"`
	ServiceName        string                 `json:"serviceName"`
	Module             string                 `json:"module"`
	Partials           map[string]interface{} `json:"partials"`
	DefaultMatchFormat string                 `json:"defaultMatchFormat"`
	Annotations        bool                   `json:"annotations"`
	Metrics            bool                   `json:"metrics"`
	BuiltIn            bool                   `json:"builtIn"`
	StaticRootConfig   *StaticRootConfig      `json:"staticRoot"`
}

type PanelPlugin struct {
	Type             string            `json:"type"`
	Name             string            `json:"name"`
	Module           string            `json:"module"`
	StaticRootConfig *StaticRootConfig `json:"staticRoot"`
}

type StaticRootConfig struct {
	Url  string `json:"url"`
	Path string `json:"path"`
}
