package preferences

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/validation/spec"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/resource"
	prefsv1 "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1"
	prefsv1alpha1 "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	apimachineryutils "github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/preferences/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

var (
	_ builder.APIGroupBuilder    = (*APIBuilder)(nil)
	_ builder.APIGroupValidation = (*APIBuilder)(nil)
)

type APIBuilder struct {
	authorizer  authorizer.Authorizer
	legacyPrefs grafanarest.Storage

	merger *merger // joins all preferences
}

func RegisterAPIService(
	cfg *setting.Cfg,
	db db.DB,
	prefs pref.Service,
	accessClient authlib.AccessClient,
	apiregistration builder.APIRegistrar,
	_ resource.ClientGenerator,
) (*APIBuilder, error) {
	sql := legacy.NewLegacySQL(legacysql.NewDatabaseProvider(db))
	builder := &APIBuilder{
		merger: newMerger(cfg),
		authorizer: &utils.AuthorizeFromName{
			OKNames:      []string{"merged"},
			AccessClient: accessClient, // can i edit a team
			Resource: map[string][]utils.ResourceOwner{
				"preferences": {
					utils.NamespaceResourceOwner,
					utils.TeamResourceOwner,
					utils.UserResourceOwner,
				},
			},
		},
	}

	namespacer := request.GetNamespaceMapper(cfg)
	if prefs != nil {
		builder.legacyPrefs = legacy.NewPreferencesStorage(prefs, namespacer, sql)
	}
	apiregistration.RegisterAPI(builder)
	return builder, nil
}

// AllowedV0Alpha1Resources implements builder.APIGroupBuilder.
func (b *APIBuilder) AllowedV0Alpha1Resources() []string {
	return nil
}

func (b *APIBuilder) GetGroupVersions() []schema.GroupVersion {
	// Stable version first, then the compatibility alias.
	// This order feeds version priority below.
	return []schema.GroupVersion{
		prefsv1.PreferencesResourceInfo.GroupVersion(),
		prefsv1alpha1.PreferencesResourceInfo.GroupVersion(),
	}
}

func (b *APIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gvv1 := prefsv1.PreferencesResourceInfo.GroupVersion()
	gvv1alpha1 := prefsv1alpha1.PreferencesResourceInfo.GroupVersion()

	scheme.AddKnownTypes(gvv1,
		&prefsv1.Preferences{},
		&prefsv1.PreferencesList{},
	)
	scheme.AddKnownTypes(gvv1alpha1,
		&prefsv1alpha1.Preferences{},
		&prefsv1alpha1.PreferencesList{},
	)

	// Required for patch (hub version) -- avoids "no kind is registered for the type"
	scheme.AddKnownTypes(schema.GroupVersion{
		Group:   gvv1.Group,
		Version: runtime.APIVersionInternal,
	},
		&prefsv1.Preferences{},
		&prefsv1.PreferencesList{},
	)

	metav1.AddToGroupVersion(scheme, gvv1)
	metav1.AddToGroupVersion(scheme, gvv1alpha1)
	return scheme.SetVersionPriority(b.GetGroupVersions()...)
}

func (b *APIBuilder) storageForVersion(
	apiGroupInfo *genericapiserver.APIGroupInfo,
	opts builder.APIGroupOptions,
	prefs apimachineryutils.ResourceInfo,
) (*preferencesStorage, error) {
	storage := map[string]rest.Storage{}

	var store grafanarest.Storage
	store, err := grafanaregistry.NewRegistryStore(opts.Scheme, prefs, opts.OptsGetter)
	if err != nil {
		return nil, err
	}
	if b.legacyPrefs != nil && opts.DualWriteBuilder != nil {
		store, err = opts.DualWriteBuilder(prefs.GroupResource(), b.legacyPrefs, store)
		if err != nil {
			return nil, err
		}
	}
	wrappedStorage := &preferencesStorage{Storage: store, gvk: prefs.GroupVersionKind()}
	storage[prefs.StoragePath()] = wrappedStorage

	apiGroupInfo.VersionedResourcesStorageMap[prefs.GroupVersion().Version] = storage
	return wrappedStorage, nil
}

func (b *APIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	// v1 (stable, storage version) -- the merger lists from this storage
	wrappedStorage, err := b.storageForVersion(apiGroupInfo, opts, prefsv1.PreferencesResourceInfo)
	if err != nil {
		return err
	}
	b.merger.lister = wrappedStorage

	// v1alpha1 (compatibility alias)
	if _, err := b.storageForVersion(apiGroupInfo, opts, prefsv1alpha1.PreferencesResourceInfo); err != nil {
		return err
	}

	return nil
}

func (b *APIBuilder) GetAuthorizer() authorizer.Authorizer {
	return b.authorizer
}

func (b *APIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return prefsv1.GetOpenAPIDefinitions
}

func (b *APIBuilder) GetAPIRoutes(gv schema.GroupVersion) *builder.APIRoutes {
	defs := b.GetOpenAPIDefinitions()(func(path string) spec.Ref { return spec.Ref{} })
	return b.merger.GetAPIRoutes(defs)
}
