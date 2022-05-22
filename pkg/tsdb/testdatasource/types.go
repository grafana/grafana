package testdatasource

type testDataQuery struct {
	Heatmap heatmapQuery `json:"heatmap"`
}

type heatmapQuery struct {
	Scale        string `json:"scale"`  //?: 'linear' | 'log2',
	Format       string `json:"format"` // dataframe type (wide,many,sparse,etc)
	Exemplars    bool   `json:"exemplars"`
	SetFrameType bool   `json:"setFrameType"`
	NumericX     bool   `json:"numericX"`
	NameAsLabel  string `json:"nameAsLabel,omitempty"`
}
