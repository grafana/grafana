package modules

const (
	All string = "all"

	BackgroundServices string = "background-services"
	// CertGenerator generates certificates for grafana-apiserver
	CertGenerator string = "cert-generator"
	// GrafanaAPIServer is the Kubertenes API server for Grafana Resources
	GrafanaAPIServer string = "grafana-apiserver"
	// HTTPServer is the HTTP server for Grafana
	HTTPServer string = "http-server"
	// Provisioning sets up Grafana with preconfigured datasources, dashboards, etc.
	Provisioning string = "provisioning"
	// KubernetesClientset provides a clientset for Kubernetes APIs
	KubernetesClientset string = "kubernetes-clientset"
	// KubernetesRegistration provides functionality to register GRDs
	KubernetesRegistration string = "kubernetes-registration"
)

var dependencyMap = map[string][]string{
	BackgroundServices: {Provisioning, HTTPServer},

	CertGenerator:    {},
	GrafanaAPIServer: {CertGenerator},

	KubernetesRegistration: {GrafanaAPIServer},
	KubernetesClientset:    {KubernetesRegistration},

	All: {KubernetesClientset, BackgroundServices},
}
