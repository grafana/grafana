package modules

const (
	All string = "all"

	CertGenerator string = "cert-generator"

	HTTPServer string = "http-server"

	KubernetesAPIServer    string = "kubernetes-apiserver"
	KubernetesRegistration string = "kubernetes-registration"
	Kubernetes             string = "kubernetes"

	Provisioning string = "provisioning"
)

var DependencyMap = map[string][]string{
	CertGenerator: {},

	HTTPServer: {CertGenerator},

	KubernetesAPIServer: {CertGenerator},
	Kubernetes:          {KubernetesAPIServer, KubernetesRegistration},

	Provisioning: {},

	All: {Kubernetes, HTTPServer, Provisioning},
}
