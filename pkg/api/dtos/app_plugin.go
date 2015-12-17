package dtos

type AppPlugin struct {
	Type     string                 `json:"type"`
	Enabled  bool                   `json:"enabled"`
	Module   string                 `json:"module"`
	JsonData map[string]interface{} `json:"jsonData"`
}
