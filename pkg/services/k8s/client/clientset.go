package client

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path"
	"path/filepath"

	"github.com/grafana/dskit/services"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	memory "k8s.io/client-go/discovery/cached"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/restmapper"

	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/k8s/apiserver"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	// ErrCRDAlreadyRegistered is returned when trying to register a duplicate CRD.
	ErrCRDAlreadyRegistered = errors.New("error registering duplicate CRD")
	// TODO not actually sure if this is correct
	GrafanaFieldManager = "core.grafana.com"
	// NOTE use getCaBundle if you need this
	caBundle []byte
)

type Resource interface {
	dynamic.ResourceInterface
}

type Service interface {
	services.NamedService
}

type ClientSetProvider interface {
	GetClientset() *Clientset
}

// Clientset is the clientset for Kubernetes APIs.
// It provides functionality to talk to the APIs as well as register new API clients for CRDs.
type Clientset struct {
	config     *rest.Config
	grafanaCfg *setting.Cfg

	clientset kubernetes.Interface
	dynamic   dynamic.Interface
	mapper    meta.RESTMapper
}

// Gets caBundle for k8s api server
func (c *Clientset) GetCABundle() []byte {
	if len(caBundle) > 0 {
		return caBundle
	}

	filename := path.Join(c.grafanaCfg.DataPath, "k8s", "apiserver.crt")
	caBytes, err := os.ReadFile(filepath.Clean(filename))
	if err != nil {
		// NOTE this should never happen
		panic(fmt.Sprintf("Missing ca bundle for k8s api server \n could not get ca bundle for k8s webhooks: %s, err: %s", filename, err.Error()))
	}

	caBundle = caBytes
	return caBundle
}

type service struct {
	*services.BasicService
	clientset          *Clientset
	restConfigProvider apiserver.RestConfigProvider
	grafanaCfg         *setting.Cfg
}

// ProvideClientset returns a new Clientset configured with cfg.
func ProvideClientsetProvider(toggles featuremgmt.FeatureToggles, restConfigProvider apiserver.RestConfigProvider, cfg *setting.Cfg) (*service, error) {
	s := &service{restConfigProvider: restConfigProvider, grafanaCfg: cfg}
	s.BasicService = services.NewBasicService(s.start, s.running, nil).WithName(modules.KubernetesClientset)
	return s, nil
}

// GetClientset returns a new Clientset configured with grafana-apiserver's loopback rest config.
func (s *service) GetClientset() *Clientset {
	_ = s.AwaitRunning(context.Background())
	return s.clientset
}

func (s *service) start(ctx context.Context) error {
	resetCfg := s.restConfigProvider.GetRestConfig()
	clientSet, err := NewClientset(resetCfg, s.grafanaCfg)
	if err != nil {
		return err
	}
	s.clientset = clientSet
	return nil
}

func (s *service) running(ctx context.Context) error {
	<-ctx.Done()
	return nil
}

// NewClientset returns a new Clientset.
func NewClientset(
	restCfg *rest.Config,
	grafanaCfg *setting.Cfg,
) (*Clientset, error) {
	k8sset, err := kubernetes.NewForConfig(restCfg)
	if err != nil {
		return nil, err
	}

	dyn, err := dynamic.NewForConfig(restCfg)
	if err != nil {
		return nil, err
	}

	mapper := restmapper.NewDeferredDiscoveryRESTMapper(memory.NewMemCacheClient(k8sset))

	return &Clientset{
		config:     restCfg,
		grafanaCfg: grafanaCfg,
		clientset:  k8sset,
		dynamic:    dyn,
		mapper:     mapper,
	}, err
}

// GetResourceClient returns a dynamic client for the given Kind and optional namespace.
func (c *Clientset) GetResourceClient(gvk schema.GroupVersionKind, namespace ...string) (dynamic.ResourceInterface, error) {
	gk := gvk.GroupKind()

	mapping, err := c.mapper.RESTMapping(gk, gvk.Version)
	if err != nil {
		return nil, err
	}

	var resourceClient dynamic.ResourceInterface
	if mapping.Scope.Name() == meta.RESTScopeNameNamespace {
		if len(namespace) == 0 {
			namespace = []string{metav1.NamespaceDefault}
		}
		resourceClient = c.dynamic.Resource(mapping.Resource).Namespace(namespace[0])
	} else {
		resourceClient = c.dynamic.Resource(mapping.Resource)
	}

	return resourceClient, nil
}
