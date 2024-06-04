package v0alpha1

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

const (
	GROUP      = "scope.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

var ScopeResourceInfo = common.NewResourceInfo(GROUP, VERSION,
	"scopes", "scope", "Scope",
	func() runtime.Object { return &Scope{} },
	func() runtime.Object { return &ScopeList{} },
)

var ScopeDashboardBindingResourceInfo = common.NewResourceInfo(GROUP, VERSION,
	"scopedashboardbindings", "scopedashboardbinding", "ScopeDashboardBinding",
	func() runtime.Object { return &ScopeDashboardBinding{} },
	func() runtime.Object { return &ScopeDashboardBindingList{} },
)

var ScopeNodeResourceInfo = common.NewResourceInfo(GROUP, VERSION,
	"scopenodes", "scopenode", "ScopeNode",
	func() runtime.Object { return &ScopeNode{} },
	func() runtime.Object { return &ScopeNodeList{} },
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
	)
	//metav1.AddToGroupVersion(scheme, gv)
	return nil
}

// Resource takes an unqualified resource and returns a Group qualified GroupResource
func Resource(resource string) schema.GroupResource {
	return SchemeGroupVersion.WithResource(resource).GroupResource()
}
