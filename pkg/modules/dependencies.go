package modules

const (
	All string = "all"

	CertGenerator string = "cert-generator"

	HTTPServer string = "http-server"

	Kine                string = "kine"
	KubernetesCRDs      string = "kubernetes-crds"
	KubernetesAPIServer string = "kubernetes-apiserver"
	KubernetesInformers string = "kubernetes-informers"
	KubernetesClientset string = "kubernetes-clientset"
	Kubernetes          string = "kubernetes"

	Provisioning string = "provisioning"

	PublicDashboardsWebhooks string = "public-dashboards-webhooks"

	SpiceDB string = "spicedb"
)

var DependencyMap = map[string][]string{
	CertGenerator: {},

	HTTPServer: {CertGenerator},

	Kine:                {},
	KubernetesAPIServer: {CertGenerator, Kine},
	KubernetesClientset: {KubernetesAPIServer},
	KubernetesCRDs:      {KubernetesClientset},
	KubernetesInformers: {KubernetesCRDs},
	Kubernetes:          {KubernetesInformers},

	Provisioning: {KubernetesCRDs},

	PublicDashboardsWebhooks: {KubernetesClientset},

	SpiceDB: {},

	All: {Kubernetes, HTTPServer, PublicDashboardsWebhooks, Provisioning, SpiceDB},
}
