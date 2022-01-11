package dtos

type QueryHistory struct {
	DataSourceUid string `json:"datasourceUid"`
	Queries       string `json:"queries"`
}

type GetQueryHistory struct {
	DataSourceUid string `json:"datasourceUid"`

	Result []QueryHistory
}
