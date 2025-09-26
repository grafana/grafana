package v0alpha1

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

const (
	GROUP      = "scope.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

var ScopeResourceInfo = utils.NewResourceInfo(GROUP, VERSION,
	"scopes", "scope", "Scope",
	func() runtime.Object { return &Scope{} },
	func() runtime.Object { return &ScopeList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Created At", Type: "date"},
			{Name: "Title", Type: "string"},
			{Name: "Filters", Type: "array"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			m, ok := obj.(*Scope)
			if !ok {
				return nil, fmt.Errorf("expected scope")
			}
			return []interface{}{
				m.Name,
				m.CreationTimestamp.UTC().Format(time.RFC3339),
				m.Spec.Title,
				m.Spec.Filters,
			}, nil
		},
	}, // default table converter
)

var ScopeDashboardBindingResourceInfo = utils.NewResourceInfo(GROUP, VERSION,
	"scopedashboardbindings", "scopedashboardbinding", "ScopeDashboardBinding",
	func() runtime.Object { return &ScopeDashboardBinding{} },
	func() runtime.Object { return &ScopeDashboardBindingList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Created At", Type: "date"},
			{Name: "Dashboard", Type: "string"},
			{Name: "Scope", Type: "string"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			m, ok := obj.(*ScopeDashboardBinding)
			if !ok {
				return nil, fmt.Errorf("expected scope dashboard binding")
			}
			return []interface{}{
				m.Name,
				m.CreationTimestamp.UTC().Format(time.RFC3339),
				m.Spec.Dashboard,
				m.Spec.Scope,
			}, nil
		},
	},
)

var ScopeNavigationResourceInfo = utils.NewResourceInfo(GROUP, VERSION,
	"scopenavigations", "scopenavigation", "ScopeNavigation",
	func() runtime.Object { return &ScopeNavigation{} },
	func() runtime.Object { return &ScopeNavigationList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Created At", Type: "date"},
			{Name: "URL", Type: "string"},
			{Name: "Scope", Type: "string"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			m, ok := obj.(*ScopeNavigation)
			if !ok {
				return nil, fmt.Errorf("expected scope navigation")
			}
			return []interface{}{
				m.Name,
				m.CreationTimestamp.UTC().Format(time.RFC3339),
				m.Spec.URL,
				m.Spec.Scope,
			}, nil
		},
	},
)

var ScopeNodeResourceInfo = utils.NewResourceInfo(GROUP, VERSION,
	"scopenodes", "scopenode", "ScopeNode",
	func() runtime.Object { return &ScopeNode{} },
	func() runtime.Object { return &ScopeNodeList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Created At", Type: "date"},
			{Name: "Title", Type: "string"},
			{Name: "Parent Name", Type: "string"},
			{Name: "Node Type", Type: "string"},
			{Name: "Link Type", Type: "string"},
			{Name: "Link ID", Type: "string"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			m, ok := obj.(*ScopeNode)
			if !ok {
				return nil, fmt.Errorf("expected scope node")
			}
			return []interface{}{
				m.Name,
				m.CreationTimestamp.UTC().Format(time.RFC3339),
				m.Spec.Title,
				m.Spec.ParentName,
				m.Spec.NodeType,
				m.Spec.LinkType,
				m.Spec.LinkID,
			}, nil
		},
	}, // default table converter
)

var (
	// SchemeGroupVersion is group version used to register these objects
	SchemeGroupVersion   = schema.GroupVersion{Group: GROUP, Version: VERSION}
	InternalGroupVersion = schema.GroupVersion{Group: GROUP, Version: runtime.APIVersionInternal}

	// SchemaBuilder is used by standard codegen
	SchemeBuilder      runtime.SchemeBuilder
	localSchemeBuilder = &SchemeBuilder
	AddToScheme        = localSchemeBuilder.AddToScheme
)

func init() {
	localSchemeBuilder.Register(func(s *runtime.Scheme) error {
		return AddKnownTypes(SchemeGroupVersion, s)
	})
}

// Adds the list of known types to the given scheme.
func AddKnownTypes(gv schema.GroupVersion, scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(gv,
		&Scope{},
		&ScopeList{},
		&ScopeDashboardBinding{},
		&ScopeDashboardBindingList{},
		&ScopeNode{},
		&ScopeNodeList{},
		&FindScopeNodeChildrenResults{},
		&FindScopeDashboardBindingsResults{},
		&ScopeNavigation{},
		&ScopeNavigationList{},
		&FindScopeNavigationsResults{},
	)
	//metav1.AddToGroupVersion(scheme, gv)
	return nil
}

// Resource takes an unqualified resource and returns a Group qualified GroupResource
func Resource(resource string) schema.GroupResource {
	return SchemeGroupVersion.WithResource(resource).GroupResource()
}
