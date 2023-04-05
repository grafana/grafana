package client

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"sync"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/k8s/apiserver"
	"github.com/grafana/grafana/pkg/services/k8s/crd"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/kindsys"
	admissionregistrationV1 "k8s.io/api/admissionregistration/v1"
	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	apiextensionsclient "k8s.io/apiextensions-apiserver/pkg/client/clientset/clientset"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8schema "k8s.io/apimachinery/pkg/runtime/schema"
	memory "k8s.io/client-go/discovery/cached"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	admissionregistrationClient "k8s.io/client-go/kubernetes/typed/admissionregistration/v1"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/restmapper"
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

	admissionRegistration admissionregistrationClient.AdmissionregistrationV1Interface
	clientset             kubernetes.Interface
	extset                apiextensionsclient.Interface
	dynamic               dynamic.Interface
	mapper                meta.RESTMapper

	crds map[k8schema.GroupVersion]apiextensionsv1.CustomResourceDefinition
	lock sync.RWMutex
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

// ShortWebhookConfig is a simple struct that is converted to a full k8s webhook config for an action on a resource.
type ShortWebhookConfig struct {
	Kind       kindsys.Kind
	Url        string
	Operations []admissionregistrationV1.OperationType
	Timeout    int32
}

// ProvideClientset returns a new Clientset configured with cfg.
func ProvideClientsetProvider(toggles featuremgmt.FeatureToggles, restConfigProvider apiserver.RestConfigProvider, cfg *setting.Cfg) (*service, error) {
	s := &service{restConfigProvider: restConfigProvider, grafanaCfg: cfg}
	s.BasicService = services.NewBasicService(s.start, s.running, nil).WithName(modules.KubernetesClientset)
	return s, nil
}

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

	extset, err := apiextensionsclient.NewForConfig(restCfg)
	if err != nil {
		return nil, err
	}

	admissionregistrationClient, err := admissionregistrationClient.NewForConfig(restCfg)
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

		clientset:             k8sset,
		admissionRegistration: admissionregistrationClient,
		extset:                extset,
		dynamic:               dyn,
		mapper:                mapper,

		crds: make(map[k8schema.GroupVersion]apiextensionsv1.CustomResourceDefinition),
		lock: sync.RWMutex{},
	}, err
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

func pontificate[T any](s T) *T {
	return &s
}
