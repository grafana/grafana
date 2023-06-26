package modules

const (
	All              string = "all"
	CertGenerator    string = "cert-generator"
	GrafanaAPIServer string = "grafana-apiserver"
)

var DependencyMap = map[string][]string{
	CertGenerator:    {},
	GrafanaAPIServer: {CertGenerator},
	All:              {},
}
