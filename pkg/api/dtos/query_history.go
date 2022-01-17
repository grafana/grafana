package dtos

type AddToQueryHistoryCmd struct {
	DataSourceUid string `json:"dataSourceUid"`
	Queries       string `json:"queries"`
}

type UpdateQueryInQueryHistoryCmd struct {
	Comment string `json:"comment"`
}
