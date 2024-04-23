package notifications

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"

	notificationsModels "github.com/grafana/grafana/pkg/apis/alerting/notifications/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/builder"
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
	return nil
}

func (t NotificationsAPIBuilder) GetAPIGroupInfo(scheme *runtime.Scheme, codecs serializer.CodecFactory, optsGetter generic.RESTOptionsGetter, dualWrite bool) (*genericapiserver.APIGroupInfo, error) {
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(notificationsModels.GROUP, scheme, metav1.ParameterCodec, codecs)

	return &apiGroupInfo, nil
}

func (t NotificationsAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return nil
}

func (t NotificationsAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	return nil
}

func (t NotificationsAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return nil
}
