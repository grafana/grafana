package alertrules

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/registry/generic"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/apis/alertrules/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/grafana-apiserver"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	grafanaregistry "github.com/grafana/grafana/pkg/services/grafana-apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/utils"
	"github.com/grafana/grafana/pkg/services/ngalert/api"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/setting"
)

// GroupName is the group name for this API.
const GroupName = "alertrules.grafana.app"
const VersionID = "v0alpha1"

var _ grafanaapiserver.APIGroupBuilder = (*AlertRulesAPIBuilder)(nil)

// This is used just so wire has something unique to return
type AlertRulesAPIBuilder struct {
	gv          schema.GroupVersion
	namespacer  request.NamespaceMapper
	ruleService api.AlertRuleService
}

func RegisterAPIService(cfg *setting.Cfg,
	features *featuremgmt.FeatureManager,
	apiregistration grafanaapiserver.APIRegistrar,
	ruleStore *store.DBstore, // the ngalert storage engine
	sqlStore db.DB,
	dashboardService dashboards.DashboardService,
	quotaService quota.Service,
) *AlertRulesAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}

	ruleService := provisioning.NewAlertRuleService(
		ruleStore,
		ruleStore,
		dashboardService,
		quotaService,
		sqlStore,
		int64(cfg.UnifiedAlerting.DefaultRuleEvaluationInterval.Seconds()),
		int64(cfg.UnifiedAlerting.BaseInterval.Seconds()),
		log.New("alerting provisioner"))

	builder := &AlertRulesAPIBuilder{
		gv:          schema.GroupVersion{Group: GroupName, Version: VersionID},
		namespacer:  request.GetNamespaceMapper(cfg),
		ruleService: ruleService,
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *AlertRulesAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return b.gv
}

func (b *AlertRulesAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(b.gv,
		&v0alpha1.AlertRule{},
		&v0alpha1.AlertRuleList{},
		&v0alpha1.AlertState{},
	)

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	//   "no kind is registered for the type"
	scheme.AddKnownTypes(schema.GroupVersion{
		Group:   b.gv.Group,
		Version: runtime.APIVersionInternal,
	},
		&v0alpha1.AlertRule{},
		&v0alpha1.AlertRuleList{},
		&v0alpha1.AlertState{},
	)

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
) (*genericapiserver.APIGroupInfo, error) {
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(GroupName, scheme, metav1.ParameterCodec, codecs)

	strategy := grafanaregistry.NewStrategy(scheme)
	store := &genericregistry.Store{
		NewFunc:                   func() runtime.Object { return &v0alpha1.AlertRule{} },
		NewListFunc:               func() runtime.Object { return &v0alpha1.AlertRuleList{} },
		PredicateFunc:             grafanaregistry.Matcher,
		DefaultQualifiedResource:  b.gv.WithResource("alertrules").GroupResource(),
		SingularQualifiedResource: b.gv.WithResource("alertrule").GroupResource(),
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
	storage["alertrules"] = &alertRuleStorage{
		store: store,
		b:     b,
	}
	storage["alertrules/state"] = &ruleStateREST{}
	storage["alertrules/pause"] = &rulePauseREST{}

	apiGroupInfo.VersionedResourcesStorageMap[VersionID] = storage
	return &apiGroupInfo, nil
}

func (b *AlertRulesAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return v0alpha1.GetOpenAPIDefinitions
}

func (b *AlertRulesAPIBuilder) GetAPIRoutes() *grafanaapiserver.APIRoutes {
	return nil // no custom API routes
}
