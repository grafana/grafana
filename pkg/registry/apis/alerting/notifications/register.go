package notifications

import (
	"context"
	"fmt"
	"maps"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/resource"
	"github.com/grafana/grafana/pkg/registry/apis/alerting/notifications/receiver"
	"github.com/grafana/grafana/pkg/registry/apis/alerting/notifications/routingtree"
	"github.com/grafana/grafana/pkg/registry/apis/alerting/notifications/templategroup"
	"github.com/grafana/grafana/pkg/registry/apis/alerting/notifications/timeinterval"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert"
	ac "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
)

var _ builder.APIGroupBuilder = (*NotificationsAPIBuilder)(nil)

// This is used just so wire has something unique to return
type NotificationsAPIBuilder struct {
	authz        accesscontrol.AccessControl
	receiverAuth receiver.AccessControlService
	ng           *ngalert.AlertNG
	namespacer   request.NamespaceMapper
}

func RegisterAPIService(
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	cfg *setting.Cfg,
	ng *ngalert.AlertNG,
) *NotificationsAPIBuilder {
	if ng.IsDisabled() || !features.IsEnabledGlobally(featuremgmt.FlagAlertingApiServer) {
		return nil
	}
	builder := &NotificationsAPIBuilder{
		ng:           ng,
		namespacer:   request.GetNamespaceMapper(cfg),
		authz:        ng.Api.AccessControl,
		receiverAuth: ac.NewReceiverAccess[*ngmodels.Receiver](ng.Api.AccessControl, false),
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

func (t *NotificationsAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return resource.GroupVersion
}

func (t *NotificationsAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	if err := receiver.AddKnownTypes(scheme); err != nil {
		return err
	}
	if err := routingtree.AddKnownTypes(scheme); err != nil {
		return err
	}
	if err := templategroup.AddKnownTypes(scheme); err != nil {
		return err
	}
	if err := timeinterval.AddKnownTypes(scheme); err != nil {
		return err
	}
	return nil
}

func (t *NotificationsAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	addStorage := func(gvr schema.GroupVersionResource, s rest.Storage) {
		v, ok := apiGroupInfo.VersionedResourcesStorageMap[gvr.Version]
		if !ok {
			v = map[string]rest.Storage{}
			apiGroupInfo.VersionedResourcesStorageMap[gvr.Version] = v
		}
		v[gvr.Resource] = s
	}

	intervals, err := timeinterval.NewStorage(t.ng.Api.MuteTimings, t.namespacer, opts)
	if err != nil {
		return fmt.Errorf("failed to initialize time-interval storage: %w", err)
	}
	addStorage(timeinterval.ResourceInfo.GroupVersionResource(), intervals)

	recvStorage, err := receiver.NewStorage(t.ng.Api.ReceiverService, t.namespacer, opts, t.ng.Api.ReceiverService)
	if err != nil {
		return fmt.Errorf("failed to initialize receiver storage: %w", err)
	}
	addStorage(receiver.ResourceInfo.GroupVersionResource(), recvStorage)

	templ, err := templategroup.NewStorage(t.ng.Api.Templates, t.namespacer, opts)
	if err != nil {
		return fmt.Errorf("failed to initialize templates group storage: %w", err)
	}
	addStorage(templategroup.ResourceInfo.GroupVersionResource(), templ)

	routeStorage, err := routingtree.NewStorage(t.ng.Api.Policies, t.namespacer)
	if err != nil {
		return fmt.Errorf("failed to initialize route storage: %w", err)
	}
	addStorage(routingtree.ResourceInfo.GroupVersionResource(), routeStorage)

	return nil
}

func (t *NotificationsAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return func(c common.ReferenceCallback) map[string]common.OpenAPIDefinition {
		tmpl := templategroup.GetOpenAPIDefinitions(c)
		tin := timeinterval.GetOpenAPIDefinitions(c)
		recv := receiver.GetOpenAPIDefinitions(c)
		rest := routingtree.GetOpenAPIDefinitions(c)
		result := make(map[string]common.OpenAPIDefinition, len(tmpl)+len(tin)+len(recv)+len(rest))
		maps.Copy(result, tmpl)
		maps.Copy(result, tin)
		maps.Copy(result, recv)
		maps.Copy(result, rest)
		return result
	}
}

// PostProcessOpenAPI is a hook to alter OpenAPI3 specification of the API server.
func (t *NotificationsAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	// The plugin description
	oas.Info.Description = "Grafana Alerting Notification resources"

	// The root api URL
	root := "/apis/" + t.GetGroupVersion().String() + "/"

	// Hide the ability to list or watch across all tenants
	delete(oas.Paths.Paths, root+receiver.ResourceInfo.GroupResource().Resource)
	delete(oas.Paths.Paths, root+timeinterval.ResourceInfo.GroupResource().Resource)
	delete(oas.Paths.Paths, root+templategroup.ResourceInfo.GroupResource().Resource)
	delete(oas.Paths.Paths, root+routingtree.ResourceInfo.GroupResource().Resource)

	// The root API discovery list
	sub := oas.Paths.Paths[root]
	if sub != nil && sub.Get != nil {
		sub.Get.Tags = []string{"API Discovery"} // sorts first in the list
	}
	return oas, nil
}

func (t *NotificationsAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
			switch a.GetResource() {
			case templategroup.ResourceInfo.GroupResource().Resource:
				return templategroup.Authorize(ctx, t.authz, a)
			case timeinterval.ResourceInfo.GroupResource().Resource:
				return timeinterval.Authorize(ctx, t.authz, a)
			case receiver.ResourceInfo.GroupResource().Resource:
				return receiver.Authorize(ctx, t.receiverAuth, a)
			case routingtree.ResourceInfo.GroupResource().Resource:
				return routingtree.Authorize(ctx, t.authz, a)
			}
			return authorizer.DecisionNoOpinion, "", nil
		})
}
