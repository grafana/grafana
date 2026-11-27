package v1beta2

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

var (
	SchemeBuilder      = runtime.NewSchemeBuilder(AddKnownTypes)
	localSchemeBuilder = &SchemeBuilder
	AddToScheme        = localSchemeBuilder.AddToScheme
)

func AddKnownTypes(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(GroupVersion,
		&Repository{},
		&RepositoryList{},
		&Connection{},
		&ConnectionList{},
		&Job{},
		&JobList{},
		&HistoricJob{},
		&HistoricJobList{},
	)
	metav1.AddToGroupVersion(scheme, GroupVersion)
	return nil
}

func Resource(resource string) schema.GroupResource {
	return GroupVersion.WithResource(resource).GroupResource()
}
