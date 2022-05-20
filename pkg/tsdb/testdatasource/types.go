package testdatasource

type testDataQuery struct {
	Heatmap heatmapQuery `json:"heatmap"`
}

type heatmapQuery struct {
	Scale        string `json:"scale"` //?: 'linear' | 'log10',
	Format       string `json:"type"`  // 'fields-wide' | 'fields-many' | 'dense' | 'sparse',
	Exemplars    bool   `json:"exemplars"`
	SetFrameType bool   `json:"setFrameType"`
	NumericX     bool   `json:"numericX"`
	NameAsLE     bool   `json:"nameAsLE"`
}
