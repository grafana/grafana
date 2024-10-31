package v0alpha1

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	runtime "k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

const (
	GROUP      = "reporting.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

var ReportResourceInfo = utils.NewResourceInfo(GROUP, VERSION,
	"reports", "report", "Report",
	func() runtime.Object { return &Report{} },
	func() runtime.Object { return &ReportList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Title", Type: "string", Format: "string"},
			{Name: "Recipients", Type: "string", Format: "string"},
			{Name: "Formats", Type: "string", Format: "string"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			r, ok := obj.(*Report)
			if ok {
				return []interface{}{
					r.Name,
					r.Spec.Title,
					r.Spec.Recipients,
					fmt.Sprintf("%v", r.Spec.Formats),
				}, nil
			}
			return nil, fmt.Errorf("expected report")
		},
	},
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
		&Report{},
		&ReportList{},
	)
	metav1.AddToGroupVersion(scheme, SchemeGroupVersion)
	return nil
}

// Resource takes an unqualified resource and returns a Group qualified GroupResource
func Resource(resource string) schema.GroupResource {
	return SchemeGroupVersion.WithResource(resource).GroupResource()
}
