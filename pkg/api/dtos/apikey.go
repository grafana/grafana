package dtos

type NewApiKeyResult struct {
	// example: 1
	ID int64 `json:"id"`
	// example: grafana
	Name string `json:"name"`
	// example: glsa_iNValIdinValiDinvalidinvalidinva_lidinVal
	Key string `json:"key"`
}
