package client

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sync"

	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/k8s/crd"
	admissionregistrationV1 "k8s.io/api/admissionregistration/v1"
	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	apiextensionsclient "k8s.io/apiextensions-apiserver/pkg/client/clientset/clientset"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8schema "k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
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
)

type Resource interface {
	dynamic.ResourceInterface
}

// Clientset is the clientset for Kubernetes APIs.
// It provides functionality to talk to the APIs as well as register new API clients for CRDs.
type Clientset struct {
	config *rest.Config

	admissionRegistration admissionregistrationClient.AdmissionregistrationV1Interface
	clientset             kubernetes.Interface
	extset                apiextensionsclient.Interface
	dynamic               dynamic.Interface
	mapper                meta.RESTMapper

	crds map[k8schema.GroupVersion]apiextensionsv1.CustomResourceDefinition
	lock sync.RWMutex
}

var _ registry.CanBeDisabled = (*Clientset)(nil)

// ProvideClientset returns a new Clientset configured with cfg.
func ProvideClientset(toggles featuremgmt.FeatureToggles, cfg *rest.Config) (*Clientset, error) {
	if !toggles.IsEnabled(featuremgmt.FlagK8s) {
		return &Clientset{}, nil
	}

	k8sset, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		return nil, err
	}

	extset, err := apiextensionsclient.NewForConfig(cfg)
	if err != nil {
		return nil, err
	}

	admissionregistrationClient, err := admissionregistrationClient.NewForConfig(cfg)
	if err != nil {
		return nil, err
	}

	dyn, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, err
	}

	mapper := restmapper.NewDeferredDiscoveryRESTMapper(memory.NewMemCacheClient(k8sset))

	return NewClientset(cfg, k8sset, extset, dyn, mapper, admissionregistrationClient)
}

// NewClientset returns a new Clientset.
func NewClientset(
	cfg *rest.Config,
	k8sset kubernetes.Interface,
	extset apiextensionsclient.Interface,
	dyn dynamic.Interface,
	mapper meta.RESTMapper,
	admissionRegistrationClient admissionregistrationClient.AdmissionregistrationV1Interface,
) (*Clientset, error) {
	clientSet := &Clientset{
		config: cfg,

		clientset:             k8sset,
		admissionRegistration: admissionRegistrationClient,
		extset:                extset,
		dynamic:               dyn,
		mapper:                mapper,

		crds: make(map[k8schema.GroupVersion]apiextensionsv1.CustomResourceDefinition),
		lock: sync.RWMutex{},
	}

	_, err := clientSet.RegisterValidation(context.Background())
	//if err != nil && !kerrors.IsAlreadyExists(err) {
	//    return err
	//}
	if err != nil {
		return nil, err
	}

	return clientSet, nil
}

func (c *Clientset) IsDisabled() bool {
	return c.config == nil
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

func (c *Clientset) RegisterValidation(ctx context.Context) (*admissionregistrationV1.ValidatingWebhookConfiguration, error) {
	obj := &admissionregistrationV1.ValidatingWebhookConfiguration{
		TypeMeta: metav1.TypeMeta{
			Kind:       "ValidatingWebhookConfiguration",
			APIVersion: "admissionregistration.k8s.io/v1",
		},
		ObjectMeta: metav1.ObjectMeta{Name: "validation.publicdashboard.core.grafana.com"},
		Webhooks: []admissionregistrationV1.ValidatingWebhook{
			{
				Name: "validation.publicdashboard.core.grafana.com",
				ClientConfig: admissionregistrationV1.WebhookClientConfig{
					URL:      pontificate("https://host.docker.internal:3443/k8s/publicdashboards/admission/create"),
					CABundle: getCABundle(),
				},
				Rules: []admissionregistrationV1.RuleWithOperations{
					{
						Operations: []admissionregistrationV1.OperationType{
							admissionregistrationV1.Create,
						},
						Rule: admissionregistrationV1.Rule{
							APIGroups:   []string{"*"},
							APIVersions: []string{"*"},
							Resources:   []string{"publicdashboards"},
							Scope:       pontificate(admissionregistrationV1.NamespacedScope),
						},
					},
				},
				TimeoutSeconds:          &fiveSeconds,
				AdmissionReviewVersions: []string{"v1"},
				SideEffects:             pontificate(admissionregistrationV1.SideEffectClassNone),
			},
		},
	}

	//hook, err := admissionApplyV1.ExtractValidatingWebhookConfiguration(obj, GrafanaFieldManager)
	//if err != nil {
	//return nil, err
	//}

	//hook.WithWebhooks(obj)
	//fmt.Printf("%#v", hook)

	force := true
	patchOpts := metav1.PatchOptions{FieldManager: GrafanaFieldManager, Force: &force}
	pretty, err := json.MarshalIndent(obj, "", "	")
	if err != nil {
		return nil, err
	}
	fmt.Println(string(pretty))

	data, err := json.Marshal(obj)
	if err != nil {
		return nil, err
	}
	return c.admissionRegistration.ValidatingWebhookConfigurations().Patch(context.Background(), obj.Name, types.ApplyPatchType, data, patchOpts)

	//err := c.admissionRegistration.ValidatingWebhookConfigurations().Patch(types.ApplyPatchType).
	//    Resource("validatingwebhookconfigurations").
	//    Name(*&obj.Name).
	//    VersionedParams(&patchOpts, scheme.ParameterCodec).
	//    Body(data).
	//    Do(ctx).
	//    Into(result)

	//return c.admissionRegistration.ValidatingWebhookConfigurations().Apply(ctx, hook, metav1.ApplyOptions{FieldManager: GrafanaFieldManager})
}

func getCABundle() []byte {
	filename := "devenv/docker/blocks/apiserver/certs/ca.pem"
	caBytes, err := os.ReadFile(filename)
	if err != nil {
		panic(fmt.Sprintf("could not get ca bundle for k8s webhooks: %s, err: %s", filename, err.Error()))
	}
	return caBytes
}

func pontificate[T any](s T) *T {
	return &s
}

var fiveSeconds int32 = 5
