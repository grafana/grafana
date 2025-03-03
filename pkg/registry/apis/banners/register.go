package banners

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	banners "github.com/grafana/grafana/pkg/apis/banners/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/extensions/licensing"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

var _ builder.APIGroupBuilder = (*BannersAPIBuilder)(nil)

// This is used just so wire has something unique to return
type BannersAPIBuilder struct {
	accessControl ac.AccessControl
}

func RegisterAPIService(features featuremgmt.FeatureToggles, apiregistration builder.APIRegistrar, token licensing.LicenseToken, accessControl ac.AccessControl) *BannersAPIBuilder {
	if !token.FeatureEnabled(licensing.FeatureAnnouncementBanner) {
		return nil // skip registration unless opting into experimental apis
	}
	builder := &BannersAPIBuilder{accessControl: accessControl}
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *BannersAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return banners.SchemeGroupVersion
}

func (b *BannersAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gv := banners.SchemeGroupVersion
	err := banners.AddToScheme(scheme)
	if err != nil {
		return err
	}

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	//   "no kind is registered for the type"
	// addKnownTypes(scheme, schema.GroupVersion{
	// 	Group:   banners.GROUP,
	// 	Version: runtime.APIVersionInternal,
	// })
	metav1.AddToGroupVersion(scheme, gv)
	return scheme.SetVersionPriority(gv)
}

func (b *BannersAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	resourceInfo := banners.AnnouncementBannerResourceInfo
	storage := map[string]rest.Storage{}
	bannerStorage, err := grafanaregistry.NewRegistryStore(opts.Scheme, resourceInfo, opts.OptsGetter)
	if err != nil {
		return err
	}
	storage[resourceInfo.StoragePath()] = bannerStorage

	apiGroupInfo.VersionedResourcesStorageMap[banners.VERSION] = storage
	return nil
}

func (b *BannersAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return banners.GetOpenAPIDefinitions
}

func (b *BannersAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
			if !attr.IsResourceRequest() {
				return authorizer.DecisionNoOpinion, "", nil
			}
			// require a user
			u, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "valid user is required", err
			}

			switch attr.GetVerb() {
			case "create", "delete", "deletecollection", "patch":
				ok, err := b.accessControl.Evaluate(ctx, u, ac.EvalPermission(ac.ActionBannersWrite))
				if !ok || err != nil {
					return authorizer.DecisionDeny, "unable to modify settings", err
				}

			// Allow everyone regardless of role to get and list banners
			case "get", "list":
				return authorizer.DecisionAllow, "", nil
			}

			// fallback to the standard org/role logic
			return authorizer.DecisionNoOpinion, "", err
		})
}
