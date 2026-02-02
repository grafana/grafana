package miscellaneous

type PARAM struct {
	Type  string      `json:"type"`
	Value interface{} `json:"value"`
}

type Config struct {
	HardDelete bool `json:"hardDelete" default:"false"`
}

type UPSERTDTO struct {
	Operation         string           `json:"operation"`
	Table             string           `json:"table"`
	PrimaryParameters map[string]PARAM `json:"primaryParameters"`
	Parameters        map[string]PARAM `json:"parameters"`
	Config            Config           `json:"config"`
}
