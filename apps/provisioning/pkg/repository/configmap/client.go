package configmap

import (
	"fmt"
	"sync"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

// ClientProvider returns a kubernetes client for host-cluster ConfigMap access.
// Implementations may return nil when Grafana is not running in a cluster.
type ClientProvider interface {
	Kubernetes() (kubernetes.Interface, error)
}

type staticClientProvider struct {
	client kubernetes.Interface
}

func (p *staticClientProvider) Kubernetes() (kubernetes.Interface, error) {
	if p.client == nil {
		return nil, fmt.Errorf("kubernetes client is not configured; ConfigMap repositories require in-cluster access")
	}
	return p.client, nil
}

// StaticClientProvider wraps an existing client (or nil).
func StaticClientProvider(client kubernetes.Interface) ClientProvider {
	return &staticClientProvider{client: client}
}

type inClusterProvider struct {
	once   sync.Once
	client kubernetes.Interface
	err    error
}

func (p *inClusterProvider) Kubernetes() (kubernetes.Interface, error) {
	p.once.Do(func() {
		cfg, err := rest.InClusterConfig()
		if err != nil {
			p.err = fmt.Errorf("in-cluster kubernetes config: %w", err)
			return
		}
		p.client, p.err = kubernetes.NewForConfig(cfg)
	})
	return p.client, p.err
}

// InClusterClientProvider lazily builds a client from in-cluster config.
func InClusterClientProvider() ClientProvider {
	return &inClusterProvider{}
}
