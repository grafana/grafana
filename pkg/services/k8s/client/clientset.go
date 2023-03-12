package client

import (
	"context"
	"errors"
	"sync"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/k8s/apiserver"
	"github.com/grafana/grafana/pkg/services/k8s/crd"
	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	apiextensionsclient "k8s.io/apiextensions-apiserver/pkg/client/clientset/clientset"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8schema "k8s.io/apimachinery/pkg/runtime/schema"
	memory "k8s.io/client-go/discovery/cached"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/restmapper"
)

var (
	// ErrCRDAlreadyRegistered is returned when trying to register a duplicate CRD.
	ErrCRDAlreadyRegistered = errors.New("error registering duplicate CRD")
)

type Resource interface {
	dynamic.ResourceInterface
}

type Service interface {
	services.Service
}

type ClientSetProvider interface {
	GetClientset() *Clientset
}

// Clientset is the clientset for Kubernetes APIs.
// It provides functionality to talk to the APIs as well as register new API clients for CRDs.
type Clientset struct {
	config *rest.Config

	clientset kubernetes.Interface
	extset    apiextensionsclient.Interface
	dynamic   dynamic.Interface
	mapper    meta.RESTMapper

	crds map[k8schema.GroupVersion]apiextensionsv1.CustomResourceDefinition
	lock sync.RWMutex
}

type service struct {
	*services.BasicService
	clientset          *Clientset
	restConfigProvider apiserver.RestConfigProvider
}

// ProvideClientset returns a new Clientset configured with cfg.
func ProvideClientsetProvier(toggles featuremgmt.FeatureToggles, restConfigProvider apiserver.RestConfigProvider) (*service, error) {
	if !toggles.IsEnabled(featuremgmt.FlagK8s) {
		return &service{}, nil
	}

	s := &service{}
	s.BasicService = services.NewBasicService(s.start, s.running, nil)

	return s, nil
}

func (s *service) GetClientset() *Clientset {
	return s.clientset
}

func (s *service) start(ctx context.Context) error {
	cfg := s.restConfigProvider.GetRestConfig()
	clientSet, err := NewClientset(cfg)
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
	cfg *rest.Config,
) (*Clientset, error) {
	k8sset, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		return nil, err
	}

	extset, err := apiextensionsclient.NewForConfig(cfg)
	if err != nil {
		return nil, err
	}

	dyn, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, err
	}

	mapper := restmapper.NewDeferredDiscoveryRESTMapper(memory.NewMemCacheClient(k8sset))

	return &Clientset{
		config: cfg,

		clientset: k8sset,
		extset:    extset,
		dynamic:   dyn,
		mapper:    mapper,

		crds: make(map[k8schema.GroupVersion]apiextensionsv1.CustomResourceDefinition),
		lock: sync.RWMutex{},
	}, nil
}

// RegisterSchema registers a k8ssys.Kind with the Kubernetes API.
func (c *Clientset) RegisterKind(ctx context.Context, gcrd crd.Kind) error {
	gvk := gcrd.GVK()
	gv := gvk.GroupVersion()

	c.lock.RLock()
	_, ok := c.crds[gv]
	c.lock.RUnlock()
	if ok {
		return ErrCRDAlreadyRegistered
	}

	crd, err := c.extset.
		ApiextensionsV1().
		CustomResourceDefinitions().
		Create(ctx, &gcrd.Schema, metav1.CreateOptions{})

	if err != nil && !kerrors.IsAlreadyExists(err) {
		return err
	}

	c.lock.Lock()
	c.crds[gv] = *crd
	c.lock.Unlock()

	return nil
}

// GetResourceClient returns a dynamic client for the given Kind and optional namespace.
func (c *Clientset) GetResourceClient(gcrd crd.Kind, namespace ...string) (dynamic.ResourceInterface, error) {
	gvk := gcrd.GVK()
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
