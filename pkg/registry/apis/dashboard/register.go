package dashboard

import (
	"context"
	"errors"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/authlib/claims"
	dashboardinternal "github.com/grafana/grafana/pkg/apis/dashboard"
	dashboardv0alpha1 "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	dashboardv1alpha1 "github.com/grafana/grafana/pkg/apis/dashboard/v1alpha1"
	dashboardv2alpha1 "github.com/grafana/grafana/pkg/apis/dashboard/v2alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

var (
	_ builder.APIGroupBuilder      = (*DashboardsAPIBuilder)(nil)
	_ builder.OpenAPIPostProcessor = (*DashboardsAPIBuilder)(nil)
)

// This is used just so wire has something unique to return
type DashboardsAPIBuilder struct {
	ProvisioningDashboardService dashboards.DashboardProvisioningService
}

func RegisterAPIService(
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	provisioningDashboardService dashboards.DashboardProvisioningService,
) *DashboardsAPIBuilder {
	builder := &DashboardsAPIBuilder{
		ProvisioningDashboardService: provisioningDashboardService,
	}
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

// Validate will prevent deletion of provisioned dashboards, unless the grace period is set to 0, indicating a force deletion
func (b *DashboardsAPIBuilder) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	op := a.GetOperation()
	if op == admission.Delete {
		obj := a.GetOperationOptions()
		deleteOptions, ok := obj.(*metav1.DeleteOptions)
		if !ok {
			return fmt.Errorf("expected v1.DeleteOptions")
		}

		if deleteOptions.GracePeriodSeconds == nil || *deleteOptions.GracePeriodSeconds != 0 {
			nsInfo, err := claims.ParseNamespace(a.GetNamespace())
			if err != nil {
				return fmt.Errorf("%v: %w", "failed to parse namespace", err)
			}

			provisioningData, err := b.ProvisioningDashboardService.GetProvisionedDashboardDataByDashboardUID(ctx, nsInfo.OrgID, a.GetName())
			if err != nil {
				if errors.Is(err, dashboards.ErrProvisionedDashboardNotFound) {
					return nil
				}

				return fmt.Errorf("%v: %w", "failed to check if dashboard is provisioned", err)
			}

			if provisioningData != nil {
				return dashboards.ErrDashboardCannotDeleteProvisionedDashboard
			}
		}
	}

	return nil
}
