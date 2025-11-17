package dtos

type NewApiKeyResult struct {
	// example: 1
	ID int64 `json:"id"`
	// example: grafana
	Name string `json:"name"`
	// example: glsa_yscW25imSKJIuav8zF37RZmnbiDvB05G_fcaaf58a
	Key string `json:"key"`
}
