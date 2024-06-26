package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

func init() {
	localSchemeBuilder.Register(AddKnownTypes)
}

const (
	GROUP      = "notifications.alerting.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

var (
	TimeIntervalResourceInfo = common.NewResourceInfo(GROUP, VERSION,
		"timeintervals", "timeinterval", "TimeIntervals",
		func() runtime.Object { return &TimeInterval{} },
		func() runtime.Object { return &TimeIntervalList{} },
	)
	ReceiverResourceInfo = common.NewResourceInfo(GROUP, VERSION,
		"receivers", "receiver", "Receiver",
		func() runtime.Object { return &Receiver{} },
		func() runtime.Object { return &ReceiverList{} },
	)
	// SchemeGroupVersion is group version used to register these objects
	SchemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}
	// SchemaBuilder is used by standard codegen
	SchemeBuilder      runtime.SchemeBuilder
	localSchemeBuilder = &SchemeBuilder
	AddToScheme        = localSchemeBuilder.AddToScheme
)

// Adds the list of known types to the given scheme.
func AddKnownTypes(scheme *runtime.Scheme) error {
	return AddKnownTypesGroup(scheme, SchemeGroupVersion)
}

// Adds the list of known types to the given scheme and group version.
func AddKnownTypesGroup(scheme *runtime.Scheme, g schema.GroupVersion) error {
	scheme.AddKnownTypes(g,
		&TimeInterval{},
		&TimeIntervalList{},
		&Receiver{},
		&ReceiverList{},
	)
	metav1.AddToGroupVersion(scheme, g)
	return nil
}

// Resource takes an unqualified resource and returns a Group qualified GroupResource
func Resource(resource string) schema.GroupResource {
	return SchemeGroupVersion.WithResource(resource).GroupResource()
}
