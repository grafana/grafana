package k8saccess

import (
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"k8s.io/client-go/kubernetes"
)

type K8SAccess interface {
	registry.CanBeDisabled
}

var _ K8SAccess = &k8sAccess{}

type k8sAccess struct {
	enabled bool
}

func ProvideK8SAccess(toggles featuremgmt.FeatureToggles, router routing.RouteRegister) K8SAccess {
	access := &k8sAccess{
		enabled: toggles.IsEnabled(featuremgmt.FlagK8s),
	}

	// Skips setting up any HTTP routing
	if !access.enabled {
		return access // dummy
	}
	return access
}

func (s *k8sAccess) IsDisabled() bool {
	return !s.enabled
}

// Return access to the system k8s client
func (s *k8sAccess) GetSystemClient() *kubernetes.Clientset {
	return nil
}
