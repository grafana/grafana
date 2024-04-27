package alerting

import (
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/grafana/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/builder"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/services/ngalert/api"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/setting"
)

var _ builder.APIGroupBuilder = (*AlertRulesAPIBuilder)(nil)

var resourceInfo = v0alpha1.AlertResourceInfo

// This is used just so wire has something unique to return
type AlertRulesAPIBuilder struct {
	gv          schema.GroupVersion
	namespacer  request.NamespaceMapper
	ruleService api.AlertRuleService
}

func RegisterAPIService(cfg *setting.Cfg,
	features *featuremgmt.FeatureManager,
	apiregistration builder.APIRegistrar,
	ruleStore *store.DBstore, // the ngalert storage engine
	sqlStore db.DB,
	dashboardService dashboards.DashboardService,
	quotaService quota.Service,
	ng *ngalert.AlertNG,
) *AlertRulesAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}

	// ruleService := provisioning.NewAlertRuleService(
	// 	ruleStore,
	// 	ruleStore,
	// 	dashboardService,
	// 	quotaService,
	// 	sqlStore,
	// 	int64(cfg.UnifiedAlerting.DefaultRuleEvaluationInterval.Seconds()),
	// 	int64(cfg.UnifiedAlerting.BaseInterval.Seconds()),
	// 	log.New("alerting provisioner"),
	// 	notifier.NewNotificationSettingsValidationService(ng.store),
	// 	ac.NewRuleService(ng.accesscontrol))

	builder := &AlertRulesAPIBuilder{
		gv:          resourceInfo.GroupVersion(),
		namespacer:  request.GetNamespaceMapper(cfg),
		ruleService: ng.API().AlertRules,
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *AlertRulesAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return b.gv
}

func addKnownTypes(scheme *runtime.Scheme, gv schema.GroupVersion) {
	scheme.AddKnownTypes(gv,
		&v0alpha1.AlertRule{},
		&v0alpha1.AlertRuleList{},
		&v0alpha1.AlertState{},
	)
}

func (b *AlertRulesAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	addKnownTypes(scheme, b.gv)

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	//   "no kind is registered for the type"
	addKnownTypes(scheme, schema.GroupVersion{
		Group:   b.gv.Group,
		Version: runtime.APIVersionInternal,
	})

	// If multiple versions exist, then register conversions from zz_generated.conversion.go
	// if err := playlist.RegisterConversions(scheme); err != nil {
	//   return err
	// }
	metav1.AddToGroupVersion(scheme, b.gv)
	return scheme.SetVersionPriority(b.gv)
}

func (b *AlertRulesAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory, // pointer?
	optsGetter generic.RESTOptionsGetter,
	dualWrite bool,
) (*genericapiserver.APIGroupInfo, error) {
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(v0alpha1.GROUP,
		scheme, metav1.ParameterCodec, codecs)

	strategy := grafanaregistry.NewStrategy(scheme)
	store := &genericregistry.Store{
		NewFunc:                   resourceInfo.NewFunc,
		NewListFunc:               resourceInfo.NewListFunc,
		PredicateFunc:             grafanaregistry.Matcher,
		DefaultQualifiedResource:  resourceInfo.GroupResource(),
		SingularQualifiedResource: resourceInfo.SingularGroupResource(),
		CreateStrategy:            strategy,
		UpdateStrategy:            strategy,
		DeleteStrategy:            strategy,
	}
	store.TableConvertor = utils.NewTableConverter(
		store.DefaultQualifiedResource,
		[]metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Title", Type: "string", Format: "string", Description: "Title"},
			{Name: "Lables", Type: "string", Format: "string", Description: "stringified labels"},
		},
		func(obj any) ([]interface{}, error) {
			r, ok := obj.(*v0alpha1.AlertRule)
			if ok {
				return []interface{}{
					r.Name,
					r.Spec.Title,
					data.Labels(r.Labels).String(),
				}, nil
			}
			return nil, fmt.Errorf("expected resource or info")
		})

	storage := map[string]rest.Storage{}
	storage[resourceInfo.StoragePath()] = &alertRuleStorage{
		store: store,
		b:     b,
	}
	storage[resourceInfo.StoragePath("state")] = &ruleStateREST{}
	storage[resourceInfo.StoragePath("pause")] = &rulePauseREST{}

	apiGroupInfo.VersionedResourcesStorageMap[v0alpha1.VERSION] = storage
	return &apiGroupInfo, nil
}

func (b *AlertRulesAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return v0alpha1.GetOpenAPIDefinitions
}

func (b *AlertRulesAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	return nil // no custom API routes
}

func (b *AlertRulesAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return nil // default authorizer is fine
}
