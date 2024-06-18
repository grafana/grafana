package notifications

import (
	"context"
	"fmt"

	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"

	notificationsModels "github.com/grafana/grafana/pkg/apis/alerting_notifications/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/builder"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	timeInterval "github.com/grafana/grafana/pkg/registry/apis/alerting/notifications/timeinterval"
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

func (t NotificationsAPIBuilder) GetDesiredDualWriterMode(dualWrite bool, toMode map[string]grafanarest.DualWriterMode) grafanarest.DualWriterMode {
	// Add required configuration support in order to enable other modes. For an example, see pkg/registry/apis/playlist/register.go
	return grafanarest.Mode0
}

func RegisterAPIService(
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	cfg *setting.Cfg,
	ng *ngalert.AlertNG,
) *NotificationsAPIBuilder {
	// if ng.IsDisabled() || !features.IsEnabledGlobally(featuremgmt.FlagAlertingNotificationsApi) {
	// 	return nil
	// }
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
	err := notificationsModels.AddToScheme(scheme)
	if err != nil {
		return err
	}
	return scheme.SetVersionPriority(notificationsModels.SchemeGroupVersion)
}

func (t NotificationsAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory,
	optsGetter generic.RESTOptionsGetter,
	desiredMode grafanarest.DualWriterMode,
	reg prometheus.Registerer,
) (*genericapiserver.APIGroupInfo, error) {
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(notificationsModels.GROUP, scheme, metav1.ParameterCodec, codecs)

	intervals, err := timeInterval.NewStorage(t.ng.Api.MuteTimings, t.namespacer, scheme, desiredMode, optsGetter, reg)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize time-interval storage: %w", err)
	}

	apiGroupInfo.VersionedResourcesStorageMap[notificationsModels.VERSION] = map[string]rest.Storage{
		notificationsModels.TimeIntervalResourceInfo.StoragePath(): intervals,
	}
	return &apiGroupInfo, nil
}

func (t NotificationsAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return notificationsModels.GetOpenAPIDefinitions
}

func (t NotificationsAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	return nil
}

func (t NotificationsAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
			switch a.GetResource() {
			case notificationsModels.TimeIntervalResourceInfo.GroupResource().Resource:
				return timeInterval.Authorize(ctx, t.authz, a)
			}
			return authorizer.DecisionNoOpinion, "", nil
		})
}
