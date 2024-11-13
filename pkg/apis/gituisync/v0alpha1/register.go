package v0alpha1

import (
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

const (
	GROUP      = "gituisync.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

var RepositoryResourceInfo = utils.NewResourceInfo(GROUP, VERSION,
	"repositories", "repository", "Repositories",
	func() runtime.Object { return &Repository{} },     // newObj
	func() runtime.Object { return &RepositoryList{} }, // newList
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Created At", Type: "date"},
			// TODO: Add more here when I figure out the model...
		},
		Reader: func(obj any) ([]interface{}, error) {
			m, ok := obj.(*Repository)
			if !ok {
				return nil, errors.New("expected Repository")
			}
			return []interface{}{
				m.Name,
				m.CreationTimestamp.UTC().Format(time.RFC3339),
			}, nil
		},
	})

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
		&Repository{},
		&RepositoryList{},
	)
	return nil
}

// Resource takes an unqualified resource and returns a Group qualified GroupResource
func Resource(resource string) schema.GroupResource {
	return SchemeGroupVersion.WithResource(resource).GroupResource()
}
