package modules

const (
	All string = "all"

	CertGenerator string = "cert-generator"

	HTTPServer string = "http-server"

	KubernetesCRDs      string = "kubernetes-crds"
	KubernetesAPIServer string = "kubernetes-apiserver"
	KubernetesInformers string = "kubernetes-informers"
	KubernetesClientset string = "kubernetes-clientset"
	Kubernetes          string = "kubernetes"

	Provisioning string = "provisioning"

	PublicDashboardsWebhooks string = "public-dashboards-webhooks"
)

var DependencyMap = map[string][]string{
	CertGenerator: {},

	HTTPServer: {CertGenerator},

	KubernetesAPIServer: {CertGenerator},
	KubernetesClientset: {KubernetesAPIServer},
	KubernetesCRDs:      {KubernetesClientset},
	KubernetesInformers: {KubernetesCRDs},
	Kubernetes:          {KubernetesInformers},

	Provisioning: {KubernetesCRDs},

	PublicDashboardsWebhooks: {KubernetesClientset},

	All: {Kubernetes, HTTPServer, Provisioning},
}
