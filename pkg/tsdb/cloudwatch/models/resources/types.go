package resources

type Dimension struct {
	Name  string
	Value string
}

type Metric struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
}
