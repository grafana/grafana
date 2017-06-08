package kairosdb

type KairosDbQuery struct {
	Start	   int64     `json:"start_absolute"`
	End        int64     `json:"end_absolute"`
	Metric  []map[string]interface{}  `json:"metrics"`
}

type KairosDbResponse struct {
	Queries []struct {
		Results []struct {
			Name   string  `json:"name"`
			Values [][]float64 `json:"values"`
		} `json:"results"`
		SampleSize int `json:"sample_size"`
	} `json:"queries"`
}

