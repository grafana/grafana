package v0alpha1

import (
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

const (
	GROUP      = "collection.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

var CollectionResourceInfo = common.NewResourceInfo(GROUP, VERSION,
	"collections", "collection", "Collection",
	func() runtime.Object { return &Collection{} },
	func() runtime.Object { return &CollectionList{} },
)

var (
	// SchemeGroupVersion is group version used to register these objects
	SchemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}

	// SchemaBuilder is used by standard codegen
	SchemeBuilder      runtime.SchemeBuilder
	localSchemeBuilder = &SchemeBuilder
	AddToScheme        = localSchemeBuilder.AddToScheme
)

func init() {
	localSchemeBuilder.Register(func(s *runtime.Scheme) error {
		return AddKnownTypes(s, VERSION)
	})
}

// Adds the list of known types to the given scheme.
func AddKnownTypes(scheme *runtime.Scheme, version string) error {
	scheme.AddKnownTypes(schema.GroupVersion{Group: GROUP, Version: version},
		&Collection{},
		&CollectionList{},
	)
	return nil
}

// Resource takes an unqualified resource and returns a Group qualified GroupResource
func Resource(resource string) schema.GroupResource {
	return SchemeGroupVersion.WithResource(resource).GroupResource()
}
