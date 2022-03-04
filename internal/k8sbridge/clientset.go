package k8sbridge

import (
	k8schema "k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/kubernetes"
	clientscheme "k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
)

// Clientset
type Clientset struct {
	*kubernetes.Clientset
	// This could be its own type, but I don't see that as necessary ATM.
	grafanacorev1client *rest.RESTClient
}

// NewClientset
func NewClientset(cfg *rest.Config) (*Clientset, error) {
	clientset, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		return nil, err
	}

	c := *cfg
	c.NegotiatedSerializer = clientscheme.Codecs.WithoutConversion()
	c.GroupVersion = &k8schema.GroupVersion{
		Group:   groupName,
		Version: groupVersion,
	}
	cli, err := rest.RESTClientFor(&c)
	if err != nil {
		return nil, err
	}

	return &Clientset{
		clientset,
		cli,
	}, nil
}

// GrafanaCoreV1
func (c *Clientset) GrafanaCoreV1() *rest.RESTClient {
	return c.grafanacorev1client
}
