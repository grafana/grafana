package modules

const (
	All string = "all"

	CertGenerator string = "cert-generator"

	HTTPServer string = "http-server"

	Kine                   string = "kine"
	KubernetesCRDs         string = "kubernetes-crds"
	KubernetesAPIServer    string = "kubernetes-apiserver"
	KubernetesInformers    string = "kubernetes-informers"
	KubernetesClientset    string = "kubernetes-clientset"
	Kubernetes             string = "kubernetes"
	KubernetesSATokensCtrl string = "kubernetes-sa-tokens-controller"

	Provisioning string = "provisioning"

	PublicDashboardsWebhooks string = "public-dashboards-webhooks"
)

var DependencyMap = map[string][]string{
	CertGenerator: {},

	HTTPServer: {CertGenerator},

	Kine:                   {},
	KubernetesAPIServer:    {CertGenerator, Kine},
	KubernetesClientset:    {KubernetesAPIServer},
	KubernetesCRDs:         {KubernetesClientset},
	KubernetesInformers:    {KubernetesCRDs},
	Kubernetes:             {KubernetesInformers, KubernetesSATokensCtrl},
	KubernetesSATokensCtrl: {KubernetesAPIServer},

	Provisioning: {KubernetesCRDs},

	PublicDashboardsWebhooks: {KubernetesClientset},

	All: {Kubernetes, HTTPServer, PublicDashboardsWebhooks, Provisioning},
}
