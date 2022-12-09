package bridge

import (
	"context"
	"errors"
	"sync"

	"github.com/grafana/grafana/pkg/kindsys/k8ssys"
	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	apiextensionsclient "k8s.io/apiextensions-apiserver/pkg/client/clientset/clientset"
	kerrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8schema "k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

var (
	// ErrCRDAlreadyRegistered is returned when trying to register a duplicate CRD.
	ErrCRDAlreadyRegistered = errors.New("error registering duplicate CRD")
)

// Clientset is the clientset for Kubernetes APIs.
// It provides functionality to talk to the APIs as well as register new API clients for CRDs.
type Clientset struct {
	// TODO: this needs to be exposed, but only specific types (e.g. no pods / deployments / etc.).
	*kubernetes.Clientset
	extset *apiextensionsclient.Clientset
	config *rest.Config
	crds   map[k8schema.GroupVersion]apiextensionsv1.CustomResourceDefinition
	lock   sync.RWMutex
}

// NewClientset returns a new Clientset configured with cfg.
func NewClientset(cfg *rest.Config) (*Clientset, error) {
	k8sset, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		return nil, err
	}

	extset, err := apiextensionsclient.NewForConfig(cfg)
	if err != nil {
		return nil, err
	}

	return &Clientset{
		Clientset: k8sset,
		extset:    extset,
		config:    cfg,
		crds:      make(map[k8schema.GroupVersion]apiextensionsv1.CustomResourceDefinition),
	}, nil
}

// RegisterSchema registers a new client and CRD for kind k
func (c *Clientset) RegisterSchema(ctx context.Context, gcrd k8ssys.Kind) error {
	gvk := gcrd.GVK()
	ver := k8schema.GroupVersion{
		Group:   gvk.Group,
		Version: gvk.Version,
	}

	c.lock.RLock()
	_, ok := c.crds[ver]
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
	c.crds[ver] = *crd
	c.lock.Unlock()

	return nil
}
