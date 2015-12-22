package dtos

type AppPlugin struct {
	Name     string                 `json:"name"`
	Type     string                 `json:"type"`
	Enabled  bool                   `json:"enabled"`
	Pinned   bool                   `json:"pinned"`
	Module   string                 `json:"module"`
	JsonData map[string]interface{} `json:"jsonData"`
}
