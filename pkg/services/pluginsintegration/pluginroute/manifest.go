package pluginroute

import (
	"context"
	"fmt"
	"net/http"

	authlib "github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-app-sdk/app"
	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/appplugin"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/kindstore"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type getter = func(ctx context.Context, gvr schema.GroupVersionResource, name string) (runtime.Object, error)

type manifestBuilder struct {
	group         string
	pluginID      string
	manifest      *app.ManifestData
	clientV3      appclientv3.Client
	decrypter     *secureValueLookup
	accessChecker appplugin.PluginAccessChecker
	accessClient  authlib.AccessChecker
	search        resourcepb.ResourceIndexClient
	store         resourcepb.ResourceStoreClient
	tracer        tracing.Tracer
	opts          Options
	getter        getter
	kinds         map[schema.GroupVersionResource]*kindstore.Store
	kindPolicies  map[string]kindPolicy

	// documents serves what the API server cannot for versions without kinds.
	// NewHandler sets it before the handler chain is built.
	documents func(next http.Handler) http.Handler
}

// GetGroupVersions returns the served versions, preferred version first.
func (b *manifestBuilder) GetGroupVersions() []schema.GroupVersion {
	group := APIGroup(b.manifest)
	gvs := make([]schema.GroupVersion, len(group.Versions))
	for i, v := range group.Versions {
		gvs[i] = schema.GroupVersion{Group: group.Name, Version: v.Version}
	}
	return gvs
}

func (b *manifestBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gvs := b.GetGroupVersions()
	if len(gvs) == 0 {
		return fmt.Errorf("plugin %s has no served versions", b.pluginID)
	}
	for _, gv := range gvs {
		if err := apppluginV0.AddKnownTypes(scheme, gv); err != nil {
			return err
		}
	}

	if b.manifest != nil {
		registered := map[schema.GroupVersionKind]bool{}
		addKind := func(gvk schema.GroupVersionKind) error {
			if registered[gvk] {
				return nil
			}
			registered[gvk] = true
			listGVK := gvk.GroupVersion().WithKind(gvk.Kind + "List")
			// The settings kind and the metav1 types are registered in every
			// served version above, and AddKnownTypeWithName panics when a GVK
			// is already bound to a different Go type -- so a kind named
			// Settings or Status would take the whole server down at startup.
			for _, taken := range []schema.GroupVersionKind{gvk, listGVK} {
				if scheme.Recognizes(taken) {
					return fmt.Errorf("kind %s in %s claims the reserved kind name %q",
						gvk.Kind, gvk.GroupVersion().String(), taken.Kind)
				}
			}
			scheme.AddKnownTypeWithName(gvk, &unstructured.Unstructured{})
			scheme.AddKnownTypeWithName(listGVK, &unstructured.UnstructuredList{})
			return nil
		}

		// Server-side apply uses the internal version to track managed fields.
		internalGV := schema.GroupVersion{Group: b.group, Version: runtime.APIVersionInternal}
		for _, version := range b.manifest.Versions {
			if !version.Served {
				continue
			}
			gv := schema.GroupVersion{Group: b.group, Version: version.Name}
			for _, r := range version.Kinds {
				if err := addKind(gv.WithKind(r.Kind)); err != nil {
					return err
				}
				if err := addKind(internalGV.WithKind(r.Kind)); err != nil {
					return err
				}
			}
		}
	}

	return scheme.SetVersionPriority(gvs...)
}

func (b *manifestBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	if opts.OptsGetter == nil {
		return fmt.Errorf("apps require a storage options getter")
	}
	kinds := make(map[schema.GroupVersionResource]*kindstore.Store)

	defs := kindstore.LoadOpenAPIDefinitions(func(name string) spec.Ref {
		return spec.MustCreateRef(name)
	}, b.group, b.manifest)

	for _, gv := range b.GetGroupVersions() {
		storage := map[string]rest.Storage{}

		// Configure storage for manifest-defined kinds.
		if b.manifest != nil {
			for _, v := range b.manifest.Versions {
				if v.Name != gv.Version {
					continue
				}

				for _, kind := range v.Kinds {
					var admission appclientv3.AdmissionClient
					var conversion appclientv3.ConversionClient
					if kind.Admission != nil {
						admission = b.clientV3
					}
					if kind.Conversion {
						conversion = b.clientV3
					}
					store, err := kindstore.New(gv.WithKind(kind.Kind), kind, admission, conversion, kindstore.Options{
						StorageOptsGetter: opts.StorageOptsGetter,
					}, defs)
					if err != nil {
						return err
					}

					// Reject duplicate plurals rather than silently replacing a kind.
					resource := store.DefaultQualifiedResource.Resource
					if _, taken := storage[resource]; taken {
						return fmt.Errorf("kind %s in %s claims the already registered resource %q",
							kind.Kind, gv.String(), resource)
					}
					storage[resource] = store
					kinds[gv.WithResource(resource)] = store

					if store.HasStatus() {
						storage[resource+"/status"] = kindstore.NewStatusStore(store)
					}
				}
			}
		}

		if len(storage) > 0 {
			apiGroupInfo.VersionedResourcesStorageMap[gv.Version] = storage
		}
	}

	b.kinds = kinds

	// Direct reads of this plugin's own storage, by group version resource.
	b.getter = func(ctx context.Context, gvr schema.GroupVersionResource, name string) (runtime.Object, error) {
		store, ok := kinds[gvr]
		if !ok {
			// This indicates a setup error not a bad request
			return nil, apierrors.NewInternalError(fmt.Errorf("no storage registered for %s", gvr))
		}
		return store.Get(ctx, name, &v1.GetOptions{})
	}
	return nil
}

func (b *manifestBuilder) AllowedV0Alpha1Resources() []string {
	return []string{builder.AllResourcesAllowed}
}
