package modules

const (
	All string = "all"

	CertGenerator string = "cert-generator"

	HTTPServer string = "http-server"

	KubernetesAPIServer string = "kubernetes-apiserver"
	Kubernetes          string = "kubernetes"

	Provisioning string = "provisioning"
)

var DependencyMap = map[string][]string{
	CertGenerator: {},

	HTTPServer: {CertGenerator},

	KubernetesAPIServer: {CertGenerator},
	Kubernetes:          {KubernetesAPIServer},

	Provisioning: {},

	All: {Kubernetes, HTTPServer, Provisioning},
}
