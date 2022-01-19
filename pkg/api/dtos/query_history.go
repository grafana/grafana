package dtos

type AddToQueryHistoryCmd struct {
	DatasourceUid string `json:"datasourceUid"`
	Queries       string `json:"queries"`
}

type UpdateQueryInQueryHistoryCmd struct {
	Comment string `json:"comment"`
}
