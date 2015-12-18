package dtos

type AppPlugin struct {
	Type        string                 `json:"type"`
	Enabled     bool                   `json:"enabled"`
	PinNavLinks bool                   `json:"pin_nav_links"`
	Module      string                 `json:"module"`
	JsonData    map[string]interface{} `json:"jsonData"`
}
