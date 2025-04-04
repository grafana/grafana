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
	GROUP      = "frontendnotification.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

var FrontendNotificationResourceInfo = utils.NewResourceInfo(GROUP, VERSION,
	"frontend-notification", "frontend-notification", "FrontendNotification",
	func() runtime.Object { return &FrontendNotification{} },
	func() runtime.Object { return &FrontendNotificationList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Message", Type: "string"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			m, ok := obj.(*FrontendNotification)
			if !ok {
				return nil, fmt.Errorf("frontend-notification")
			}
			return []interface{}{
				m.Name,
				m.Spec.Message,
				m.CreationTimestamp.UTC().Format(time.RFC3339),
			}, nil
		},
	}, // default table converter
)

var (
	// SchemeGroupVersion is group version used to register these objects
	SchemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}

	// SchemeBuilder is used by standard codegen
	SchemeBuilder      runtime.SchemeBuilder
	localSchemeBuilder = &SchemeBuilder
	AddToScheme        = localSchemeBuilder.AddToScheme
)

func init() {
	SchemeBuilder.Register(addKnownTypes)
}

func addKnownTypes(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(SchemeGroupVersion,
		&FrontendNotification{},
		&FrontendNotificationList{},
	)
	metav1.AddToGroupVersion(scheme, SchemeGroupVersion)
	return nil
}

func Resource(resource string) schema.GroupResource {
	return SchemeGroupVersion.WithResource(resource).GroupResource()
}
