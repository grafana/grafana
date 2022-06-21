package testdatasource

type testDataQuery struct {
	Heatmap heatmapQuery `json:"heatmap"`
}

type heatmapQuery struct {
	Scale            string `json:"scale"`  //?: 'linear' | 'log2',
	Format           string `json:"format"` // dataframe type (wide,many,sparse,etc)
	Exemplars        bool   `json:"exemplars,omitempty"`
	NameAsLabel      string `json:"nameAsLabel,omitempty"`
	ExcludeFrameType bool   `json:"excludeFrameType,omitempty"`
	NumericX         bool   `json:"numericX,omitempty"`
}
