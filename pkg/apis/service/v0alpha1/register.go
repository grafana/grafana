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
	GROUP      = "service.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

var ExternalNameResourceInfo = utils.NewResourceInfo(GROUP, VERSION,
	"externalnames", "externalname", "ExternalName",
	func() runtime.Object { return &ExternalName{} },
	func() runtime.Object { return &ExternalNameList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Host", Type: "string", Format: "string", Description: "The service host"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			m, ok := obj.(*ExternalName)
			if !ok {
				return nil, fmt.Errorf("expected external name")
			}
			return []interface{}{
				m.Name,
				m.Spec.Host,
				m.CreationTimestamp.UTC().Format(time.RFC3339),
			}, nil
		},
	}, // default table converter
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
	localSchemeBuilder.Register(addKnownTypes)
}

// Adds the list of known types to the given scheme.
func addKnownTypes(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(SchemeGroupVersion,
		&ExternalName{},
		&ExternalNameList{},
	)
	metav1.AddToGroupVersion(scheme, SchemeGroupVersion)
	return nil
}

// Resource takes an unqualified resource and returns a Group qualified GroupResource
func Resource(resource string) schema.GroupResource {
	return SchemeGroupVersion.WithResource(resource).GroupResource()
}
