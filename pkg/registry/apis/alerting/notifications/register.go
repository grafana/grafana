package notifications

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/grafana/pkg/apis/alerting/notifications"
	notificationsModels "github.com/grafana/grafana/pkg/apis/alerting/notifications/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/builder"
	"github.com/grafana/grafana/pkg/registry/apis/alerting/notifications/template"
	timeIntervals "github.com/grafana/grafana/pkg/registry/apis/alerting/notifications/time-intervals"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/setting"
)

var _ builder.APIGroupBuilder = (*NotificationsAPIBuilder)(nil)

// This is used just so wire has something unique to return
type NotificationsAPIBuilder struct {
	authz      accesscontrol.AccessControl
	ng         *ngalert.AlertNG
	namespacer request.NamespaceMapper
	gv         schema.GroupVersion
}

func RegisterAPIService(
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	cfg *setting.Cfg,
	ng *ngalert.AlertNG,
) *NotificationsAPIBuilder {
	if ng.IsDisabled() || !features.IsEnabledGlobally(featuremgmt.FlagAlertingNotificationsApi) {
		return nil
	}
	builder := &NotificationsAPIBuilder{
		ng:         ng,
		namespacer: request.GetNamespaceMapper(cfg),
		gv:         notificationsModels.SchemeGroupVersion,
		authz:      ng.Api.AccessControl,
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

func (t NotificationsAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return t.gv
}

func (t NotificationsAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(t.gv,
		&notificationsModels.TemplateGroup{},
		&notificationsModels.TemplateGroupList{},
		&notificationsModels.Template{},
		&notificationsModels.TemplateList{},
		&notificationsModels.TimeInterval{},
		&notificationsModels.TimeIntervalList{},
	)
	metav1.AddToGroupVersion(scheme, t.gv)
	return scheme.SetVersionPriority(t.gv)
}

func (t NotificationsAPIBuilder) GetAPIGroupInfo(scheme *runtime.Scheme, codecs serializer.CodecFactory, optsGetter generic.RESTOptionsGetter, dualWrite bool) (*genericapiserver.APIGroupInfo, error) {
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(notificationsModels.GROUP, scheme, metav1.ParameterCodec, codecs)

	templ, err := template.NewStorage(t.ng.Api.Templates, t.namespacer, scheme, dualWrite, optsGetter)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize templates storage: %w", err)
	}

	intervals, err := timeIntervals.NewStorage(t.ng.Api.MuteTimings, t.namespacer, scheme, dualWrite, optsGetter)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize time-interval storage: %w", err)
	}

	apiGroupInfo.VersionedResourcesStorageMap[notificationsModels.VERSION] = map[string]rest.Storage{
		notificationsModels.TemplateGroupResourceInfo.StoragePath():            templ,
		notificationsModels.TemplateGroupResourceInfo.StoragePath("templates"): template.NewTemplateConnect(templ),
		notificationsModels.TimeIntervalResourceInfo.StoragePath():             intervals,
	}
	return &apiGroupInfo, nil
}

func (t NotificationsAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return notifications.GetOpenAPIDefinitions
}

func (t NotificationsAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	return nil
}

func (t NotificationsAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
			switch a.GetResource() {
			case notificationsModels.TemplateGroupResourceInfo.GroupResource().Resource:
				return template.Authorize(ctx, t.authz, a)
			case notificationsModels.TimeIntervalResourceInfo.GroupResource().Resource:
				return timeIntervals.Authorize(ctx, t.authz, a)
			}
			return authorizer.DecisionNoOpinion, "", nil
		})
}
