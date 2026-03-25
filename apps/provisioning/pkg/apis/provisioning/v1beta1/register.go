package v1beta1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	v0alpha1 "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

const (
	GROUP   = "provisioning.grafana.app"
	VERSION = "v1beta1"
)

// SchemeGroupVersion is group version used to register these objects
var SchemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}

// Resource takes an unqualified resource and returns a Group qualified GroupResource
func Resource(resource string) schema.GroupResource {
	return SchemeGroupVersion.WithResource(resource).GroupResource()
}

var (
	// SchemaBuilder is used by standard codegen
	SchemeBuilder      = runtime.NewSchemeBuilder(addKnownTypes)
	localSchemeBuilder = &SchemeBuilder
	AddToScheme        = localSchemeBuilder.AddToScheme
)

// Adds the list of known types to the given scheme.
func addKnownTypes(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(SchemeGroupVersion,
		&v0alpha1.Repository{},
		&v0alpha1.RepositoryList{},
		&v0alpha1.Connection{},
		&v0alpha1.ConnectionList{},
		&v0alpha1.Job{},
		&v0alpha1.JobList{},
		&v0alpha1.HistoricJob{},
		&v0alpha1.HistoricJobList{},
		&v0alpha1.WebhookResponse{},
		&v0alpha1.ResourceWrapper{},
		&v0alpha1.FileList{},
		&v0alpha1.HistoryList{},
		&v0alpha1.TestResults{},
		&v0alpha1.ResourceList{},
		&v0alpha1.ResourceStats{},
		&v0alpha1.RefList{},
		&v0alpha1.ExternalRepositoryList{},
	)
	metav1.AddToGroupVersion(scheme, SchemeGroupVersion)
	return nil
}
