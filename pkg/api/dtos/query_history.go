package dtos

type QueryHistory struct {
	DataSourceUid string `json:"datasourceUid"`
	Queries       string `json:"queries"`
}

type UpdateQueryInQueryHistory struct {
	Comment string `json:"comment"`
}
