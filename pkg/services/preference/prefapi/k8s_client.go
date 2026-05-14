package prefapi

import (
	"context"
	"encoding/json"
	stderrors "errors"
	"fmt"

	"k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/dynamic"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	prefutils "github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/setting"
)

//go:generate mockery --name K8sClient --structname MockK8sClient --inpackage --filename k8s_client_mock.go --with-expecter

// K8sClient performs the underlying preferences.grafana.app calls used by
// the legacy /api preferences bridge. It is intentionally narrow so it can
// be mocked in tests of the legacy handlers.
type K8sClient interface {
	Get(ctx context.Context, owner prefutils.OwnerReference) (*preferences.PreferencesSpec, error)
	Update(ctx context.Context, owner prefutils.OwnerReference, spec *preferences.PreferencesSpec) error
	Patch(ctx context.Context, owner prefutils.OwnerReference, spec *preferences.PreferencesSpec) error
}

type k8sClient struct {
	namespacer           request.NamespaceMapper
	gvr                  schema.GroupVersionResource
	clientConfigProvider grafanaapiserver.DirectRestConfigProvider
}

var _ K8sClient = (*k8sClient)(nil)

// NewK8sClient constructs the default K8sClient backed by the dynamic
// kubernetes client.
func NewK8sClient(cfg *setting.Cfg, configProvider grafanaapiserver.DirectRestConfigProvider) K8sClient {
	return &k8sClient{
		namespacer:           request.GetNamespaceMapper(cfg),
		gvr:                  preferences.PreferencesResourceInfo.GroupVersionResource(),
		clientConfigProvider: configProvider,
	}
}

func (k *k8sClient) Get(ctx context.Context, owner prefutils.OwnerReference) (*preferences.PreferencesSpec, error) {
	client, err := k.getClient(ctx)
	if err != nil {
		return nil, err
	}
	out, err := client.Get(ctx, owner.AsName(), v1.GetOptions{})
	if err != nil {
		if errors.IsNotFound(err) {
			return &preferences.PreferencesSpec{}, nil
		}
		return nil, err
	}
	return unstructuredToSpec(out)
}

// Update upserts preferences for the given owner. The underlying storage
// (pkg/registry/apis/preferences/legacy.preferenceStorage.Update) handles
// the missing-resource case by creating an empty placeholder, so we don't
// need a preflight Get.
func (k *k8sClient) Update(ctx context.Context, owner prefutils.OwnerReference, spec *preferences.PreferencesSpec) error {
	client, err := k.getClient(ctx)
	if err != nil {
		return err
	}
	obj, err := newPreferencesObject(owner.AsName(), spec)
	if err != nil {
		return err
	}
	_, err = client.Update(ctx, obj, v1.UpdateOptions{})
	return err
}

// Patch applies a JSON merge-patch to the preferences for the given owner.
// The underlying storage upserts on missing resources by returning a UID-bearing
// placeholder from its Update method, so this also works as upsert.
func (k *k8sClient) Patch(ctx context.Context, owner prefutils.OwnerReference, spec *preferences.PreferencesSpec) error {
	body, err := json.Marshal(struct {
		Spec *preferences.PreferencesSpec `json:"spec"`
	}{Spec: spec})
	if err != nil {
		return err
	}

	client, err := k.getClient(ctx)
	if err != nil {
		return err
	}

	_, err = client.Patch(ctx, owner.AsName(), types.MergePatchType, body, v1.PatchOptions{})
	return err
}

func (k *k8sClient) getClient(ctx context.Context) (dynamic.ResourceInterface, error) {
	reqCtx := contexthandler.FromContext(ctx)
	if reqCtx == nil {
		return nil, stderrors.New("no request context")
	}
	dyn, err := dynamic.NewForConfig(k.clientConfigProvider.GetDirectRestConfig(reqCtx))
	if err != nil {
		return nil, err
	}
	return dyn.Resource(k.gvr).Namespace(k.namespacer(reqCtx.OrgID)), nil
}

func newPreferencesObject(name string, spec *preferences.PreferencesSpec) (*unstructured.Unstructured, error) {
	specMap, err := runtime.DefaultUnstructuredConverter.ToUnstructured(spec)
	if err != nil {
		return nil, err
	}
	obj := &unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": preferences.GroupVersion.String(),
			"kind":       preferences.PreferencesResourceInfo.GroupVersionKind().Kind,
			"spec":       specMap,
		},
	}
	obj.SetName(name)
	return obj, nil
}

func unstructuredToSpec(item *unstructured.Unstructured) (*preferences.PreferencesSpec, error) {
	raw, ok := item.Object["spec"]
	if !ok || raw == nil {
		return &preferences.PreferencesSpec{}, nil
	}
	specMap, ok := raw.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("preferences spec is not an object")
	}
	spec := &preferences.PreferencesSpec{}
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(specMap, spec); err != nil {
		return nil, err
	}
	return spec, nil
}
