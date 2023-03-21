package modules

const (
	All                 string = "all"
	Kine                string = "kine"
	KubernetesCRDs      string = "kubernetes-crds"
	KubernetesAPIServer string = "kubernetes-apiserver"
	KubernetesInformers string = "kubernetes-informers"
	KubernetesClientset string = "kubernetes-clientset"
	Kubernetes          string = "kubernetes"
)

var DependencyMap = map[string][]string{
	Kine:                {},
	KubernetesAPIServer: {Kine},
	KubernetesClientset: {KubernetesAPIServer},
	KubernetesCRDs:      {KubernetesClientset},
	KubernetesInformers: {KubernetesCRDs},

	Kubernetes: {KubernetesInformers},
	All:        {Kubernetes},
}
