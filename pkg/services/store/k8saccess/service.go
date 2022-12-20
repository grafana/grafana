package k8saccess

import (
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

type K8SAccess interface {
	registry.CanBeDisabled

	// Get the system client
	GetSystemClient() *kubernetes.Clientset
}

var _ K8SAccess = &k8sAccess{}

type k8sAccess struct {
	enabled   bool
	apihelper *httpHelper
	sys       *clientWrapper
}

func ProvideK8SAccess(toggles featuremgmt.FeatureToggles, router routing.RouteRegister) K8SAccess {
	access := &k8sAccess{
		enabled: toggles.IsEnabled(featuremgmt.FlagK8s),
	}

	// Skips setting up any HTTP routing
	if !access.enabled {
		return access // dummy
	}

	// If we are in a cluster, this is the
	config, err := rest.InClusterConfig()

	// Look for kube config setup
	if err != nil {
		var home string
		var configBytes []byte
		home, err = os.UserHomeDir()
		if err == nil {
			fpath := filepath.Join(home, ".kube", "config")
			//nolint:gosec
			configBytes, err = os.ReadFile(fpath)
			if err == nil {
				config, err = clientcmd.RESTConfigFromKubeConfig(configBytes)
			}
		}
	}

	if err == nil && config != nil {
		access.sys = newClientWrapper(config)
	} else {
		access.sys = &clientWrapper{
			err: err,
		}
	}

	access.apihelper = newHTTPHelper(access, router)
	return access
}

func (s *k8sAccess) IsDisabled() bool {
	return !s.enabled
}

// Return access to the system k8s client
func (s *k8sAccess) GetSystemClient() *kubernetes.Clientset {
	if s.sys != nil {
		return s.sys.client
	}
	return nil
}
