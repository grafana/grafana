package v2

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

const (
	GROUP      = "dashboard.grafana.app"
	VERSION    = "v2"
	APIVERSION = GROUP + "/" + VERSION
)

var DashboardResourceInfo = utils.NewResourceInfo(GROUP, VERSION,
	"dashboards", "dashboard", "Dashboard",
	func() runtime.Object { return &Dashboard{} },
	func() runtime.Object { return &DashboardList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Title", Type: "string", Format: "string", Description: "The dashboard name"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			dash, ok := obj.(*Dashboard)
			if ok {
				if dash != nil {
					return []interface{}{
						dash.Name,
						dash.Spec.Title,
						dash.CreationTimestamp.UTC().Format(time.RFC3339),
					}, nil
				}
			}
			return nil, fmt.Errorf("expected dashboard")
		},
	},
)

var VariableResourceInfo = utils.NewResourceInfo(GROUP, VERSION,
	"variables", "variable", "Variable",
	func() runtime.Object { return &Variable{} },
	func() runtime.Object { return &VariableList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Variable Kind", Type: "string", Format: "string", Description: "The global variable type"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			variable, ok := obj.(*Variable)
			if ok {
				if variable != nil {
					return []interface{}{
						variable.Name,
						getVariableKindName(variable.Spec),
						variable.CreationTimestamp.UTC().Format(time.RFC3339),
					}, nil
				}
			}
			return nil, fmt.Errorf("expected variable")
		},
	},
)

var (
	SchemeBuilder      runtime.SchemeBuilder
	localSchemeBuilder = &SchemeBuilder
	AddToScheme        = localSchemeBuilder.AddToScheme
	schemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}
)

func init() {
	localSchemeBuilder.Register(addKnownTypes, addDefaultingFuncs)
}

// Adds the list of known types to the given scheme.
func addKnownTypes(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(schemeGroupVersion,
		&Dashboard{},
		&DashboardList{},
		&DashboardWithAccessInfo{},
		&Variable{},
		&VariableList{},
		&metav1.PartialObjectMetadata{},
		&metav1.PartialObjectMetadataList{},
	)
	metav1.AddToGroupVersion(scheme, schemeGroupVersion)
	return nil
}

func getVariableKindName(spec VariableSpec) string {
	switch {
	case spec.QueryVariableKind != nil:
		return spec.QueryVariableKind.Kind
	case spec.TextVariableKind != nil:
		return spec.TextVariableKind.Kind
	case spec.ConstantVariableKind != nil:
		return spec.ConstantVariableKind.Kind
	case spec.DatasourceVariableKind != nil:
		return spec.DatasourceVariableKind.Kind
	case spec.IntervalVariableKind != nil:
		return spec.IntervalVariableKind.Kind
	case spec.CustomVariableKind != nil:
		return spec.CustomVariableKind.Kind
	case spec.GroupByVariableKind != nil:
		return spec.GroupByVariableKind.Kind
	case spec.AdhocVariableKind != nil:
		return spec.AdhocVariableKind.Kind
	case spec.SwitchVariableKind != nil:
		return spec.SwitchVariableKind.Kind
	default:
		return ""
	}
}

func addDefaultingFuncs(scheme *runtime.Scheme) error {
	return RegisterDefaults(scheme)
}
