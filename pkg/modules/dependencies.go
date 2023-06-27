package modules

const (
	All string = "all"

	CertGenerator string = "cert-generator"

	HTTPServer string = "http-server"

	KubernetesAPIServer    string = "kubernetes-apiserver"
	KubernetesRegistration string = "kubernetes-registration"
	Kubernetes             string = "kubernetes"
	KubernetesClientset    string = "kubernetes-clientset"

	Provisioning string = "provisioning"
)

var DependencyMap = map[string][]string{
	CertGenerator: {},

	HTTPServer: {CertGenerator},

	KubernetesAPIServer:    {CertGenerator},
	KubernetesRegistration: {KubernetesAPIServer},
	KubernetesClientset:    {KubernetesRegistration},
	Kubernetes:             {KubernetesClientset},

	Provisioning: {},

	All: {Kubernetes, HTTPServer, Provisioning},
}
