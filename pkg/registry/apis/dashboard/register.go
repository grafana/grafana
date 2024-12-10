package dashboard

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"

	dashboardinternal "github.com/grafana/grafana/pkg/apis/dashboard"
	dashboardv0alpha1 "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	dashboardv1alpha1 "github.com/grafana/grafana/pkg/apis/dashboard/v1alpha1"
	dashboardv2alpha1 "github.com/grafana/grafana/pkg/apis/dashboard/v2alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

var (
	_ builder.APIGroupBuilder      = (*DashboardsAPIBuilder)(nil)
	_ builder.OpenAPIPostProcessor = (*DashboardsAPIBuilder)(nil)
)

// This is used just so wire has something unique to return
type DashboardsAPIBuilder struct{}

func RegisterAPIService(
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
) *DashboardsAPIBuilder {
	builder := &DashboardsAPIBuilder{}
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *DashboardsAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return dashboardinternal.DashboardResourceInfo.GroupVersion()
}

func (b *DashboardsAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return nil // no authorizer
}

func (b *DashboardsAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	if err := dashboardinternal.AddToScheme(scheme); err != nil {
		return err
	}
	return scheme.SetVersionPriority(
		dashboardv0alpha1.DashboardResourceInfo.GroupVersion(),
		dashboardv1alpha1.DashboardResourceInfo.GroupVersion(),
		dashboardv2alpha1.DashboardResourceInfo.GroupVersion(),
	)
}

func (b *DashboardsAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	return nil
}

func (b *DashboardsAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return nil
}

func (b *DashboardsAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	return oas, nil
}
