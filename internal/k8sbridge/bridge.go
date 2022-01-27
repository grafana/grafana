// Package k8sbridge provides interfaces for communicating with an underlying
// Kubernetes apiserver

package k8sbridge

import (
	"github.com/grafana/grafana/pkg/schema"
	"k8s.io/client-go/rest"
	ctrl "sigs.k8s.io/controller-runtime"
)

// Should we write some simple watcher / interface consumer so that we can test if our interface works?

// TODO figure out whether we take a *rest.Config in this provider, which implies
// that something else will turn grafana.ini config into a *rest.Config, OR if we take
// raw config in this provider and make the *rest.Config ourselves
// ALso depends on outcome of deciding what our config will be https://github.com/grafana/grafana/issues/44291
func ProvideAPIServerClient(cfg *rest.Config) (*rest.RESTClient, error) {
	return rest.RESTClientFor(cfg)
}

// TODO: May rename to just ProvideService if we are sure the package will only have one service.
func ProvideBridgeService(cfg *rest.Config, list schema.CoreSchemaList) (*Bridge, error) {
	c, err := rest.RESTClientFor(cfg)
	if err != nil {
		return nil, err
	}

	mgropts := ctrl.Options{
		Scheme: nil, // TODO fill me in by populating from reg
	}

	mgr, err := ctrl.NewManager(cfg, mgropts)
	if err != nil {
		return nil, err
	}

	b := &Bridge{
		Client:  c,
		Schemas: list,
		Manager: mgr,
	}

	return b, nil
}

type Bridge struct {
	Client  *rest.RESTClient
	Schemas schema.CoreSchemaList
	Manager ctrl.Manager
}
