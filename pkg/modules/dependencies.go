package modules

const (
	All string = "all"

	BackgroundServices string = "background-services"
	CertGenerator      string = "cert-generator"

	HTTPServer string = "http-server"

	KubernetesAPIServer    string = "kubernetes-apiserver"
	KubernetesRegistration string = "kubernetes-registration"
	Kubernetes             string = "kubernetes"
	KubernetesClientset    string = "kubernetes-clientset"

	Provisioning string = "provisioning"
)

var dependencyMap = map[string][]string{
	CertGenerator: {},

	HTTPServer: {CertGenerator},

	KubernetesAPIServer:    {CertGenerator},
	KubernetesRegistration: {KubernetesAPIServer},
	KubernetesClientset:    {KubernetesRegistration},
	Kubernetes:             {KubernetesClientset},

	Provisioning: {},

	All: {BackgroundServices, Kubernetes, HTTPServer, Provisioning},
}
