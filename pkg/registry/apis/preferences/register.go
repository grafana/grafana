package preferences

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/validation/spec"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/preferences/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

var (
	_ builder.APIGroupBuilder    = (*APIBuilder)(nil)
	_ builder.APIGroupValidation = (*APIBuilder)(nil)
)

type APIBuilder struct {
	authorizer  authorizer.Authorizer
	legacyPrefs rest.Storage

	merger *merger // joins all preferences
}

func RegisterAPIService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	db db.DB,
	prefs pref.Service,
	users user.Service,
	apiregistration builder.APIRegistrar,
) *APIBuilder {
	sql := legacy.NewLegacySQL(legacysql.NewDatabaseProvider(db))
	builder := &APIBuilder{
		merger: newMerger(cfg, sql),
		authorizer: &utils.AuthorizeFromName{
			OKNames: []string{"merged"},
			Teams:   sql, // should be from the IAM service
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
	return builder
}

// AllowedV0Alpha1Resources implements builder.APIGroupBuilder.
func (b *APIBuilder) AllowedV0Alpha1Resources() []string {
	return nil
}

func (b *APIBuilder) GetGroupVersion() schema.GroupVersion {
	return preferences.GroupVersion
}

func (b *APIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gv := preferences.GroupVersion
	err := preferences.AddToScheme(scheme)
	if err != nil {
		return err
	}

	metav1.AddToGroupVersion(scheme, gv)
	return scheme.SetVersionPriority(gv)
}

func (b *APIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	storage := map[string]rest.Storage{}

	prefs := preferences.PreferencesResourceInfo
	storage[prefs.StoragePath()] = b.legacyPrefs

	apiGroupInfo.VersionedResourcesStorageMap[preferences.APIVersion] = storage
	return nil
}

func (b *APIBuilder) GetAuthorizer() authorizer.Authorizer {
	return b.authorizer
}

func (b *APIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return preferences.GetOpenAPIDefinitions
}

func (b *APIBuilder) GetAPIRoutes(gv schema.GroupVersion) *builder.APIRoutes {
	defs := b.GetOpenAPIDefinitions()(func(path string) spec.Ref { return spec.Ref{} })
	return b.merger.GetAPIRoutes(defs)
}

// Validate validates that the preference object has valid theme and timezone (if specified)
func (b *APIBuilder) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	if a.GetResource().Resource != "preferences" {
		return nil
	}

	op := a.GetOperation()
	if op != admission.Create && op != admission.Update {
		return nil
	}

	obj := a.GetObject()
	p, ok := obj.(*preferences.Preferences)
	if !ok {
		return apierrors.NewBadRequest(fmt.Sprintf("expected Preferences object, got %T", obj))
	}

	if p.Spec.Timezone != nil && !pref.IsValidTimezone(*p.Spec.Timezone) {
		return apierrors.NewBadRequest("invalid timezone: must be a valid IANA timezone (e.g., America/New_York), 'utc', 'browser', or empty string")
	}

	if p.Spec.Theme != nil && *p.Spec.Theme != "" && !pref.IsValidThemeID(*p.Spec.Theme) {
		return apierrors.NewBadRequest("invalid theme")
	}

	return nil
}
