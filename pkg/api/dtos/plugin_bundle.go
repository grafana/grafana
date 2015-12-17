package dtos

type PluginBundle struct {
	Type     string                 `json:"type"`
	Enabled  bool                   `json:"enabled"`
	Module   string                 `json:"module"`
	JsonData map[string]interface{} `json:"jsonData"`
}
