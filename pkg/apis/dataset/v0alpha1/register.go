package v0alpha1

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

const (
	GROUP      = "dataset.grafana.app"
	VERSION    = "v0alpha1"
	RESOURCE   = "datasets"
	APIVERSION = GROUP + "/" + VERSION
)

var DatasetResourceInfo = utils.NewResourceInfo(GROUP, VERSION,
	RESOURCE, "dataset", "Dataset",
	func() runtime.Object { return &Dataset{} },
	func() runtime.Object { return &DatasetList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Title", Type: "string", Format: "string", Description: "The display name"},
			{Name: "Parent", Type: "string", Format: "string", Description: "Parent folder UID"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			r, ok := obj.(*Dataset)
			if ok {
				accessor, _ := utils.MetaAccessor(r)
				return []interface{}{
					r.Name,
					r.Spec.Title,
					accessor.GetFolder(),
				}, nil
			}
			return nil, fmt.Errorf("expected dataset")
		},
	},
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
		&Dataset{},
		&DatasetList{},
	)
	return nil
}

// Resource takes an unqualified resource and returns a Group qualified GroupResource
func Resource(resource string) schema.GroupResource {
	return SchemeGroupVersion.WithResource(resource).GroupResource()
}
