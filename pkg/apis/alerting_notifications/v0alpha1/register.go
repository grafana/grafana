package v0alpha1

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	receiver "github.com/grafana/grafana/apps/alerting/notifications/apis/resource/receiver/v0alpha1"
	routingtree "github.com/grafana/grafana/apps/alerting/notifications/apis/resource/routingtree/v0alpha1"
	templategroup "github.com/grafana/grafana/apps/alerting/notifications/apis/resource/templategroup/v0alpha1"
	timeinterval "github.com/grafana/grafana/apps/alerting/notifications/apis/resource/timeinterval/v0alpha1"

	scope "github.com/grafana/grafana/pkg/apis/scope/v0alpha1"
)

func init() {
	localSchemeBuilder.Register(AddKnownTypes)
}

const (
	GROUP                      = "notifications.alerting.grafana.app"
	VERSION                    = "v0alpha1"
	APIVERSION                 = GROUP + "/" + VERSION
	UserDefinedRoutingTreeName = "user-defined"
)

var (
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
		&timeinterval.TimeInterval{},
		&timeinterval.TimeIntervalList{},
		&receiver.Receiver{},
		&receiver.ReceiverList{},
		&templategroup.TemplateGroup{},
		&templategroup.TemplateGroupList{},
		&routingtree.RoutingTree{},
		&routingtree.RoutingTreeList{},
	)
	metav1.AddToGroupVersion(scheme, g)

	intevalKind := timeinterval.Kind()
	intervalGvk := intevalKind.GroupVersionKind()

	err := scheme.AddFieldLabelConversionFunc(
		intervalGvk,
		func(label, value string) (string, string, error) {
			fieldSet := timeinterval.SelectableFields(&timeinterval.TimeInterval{})
			for key := range fieldSet {
				if label == key {
					return label, value, nil
				}
			}
			return "", "", fmt.Errorf("field label not supported for %s: %s", scope.ScopeNodeResourceInfo.GroupVersionKind(), label)
		},
	)
	if err != nil {
		return err
	}

	receiverKind := templategroup.Kind()
	receiverGvk := receiverKind.GroupVersionKind()
	err = scheme.AddFieldLabelConversionFunc(
		receiverGvk,
		func(label, value string) (string, string, error) {
			fieldSet := receiver.SelectableFields(&receiver.Receiver{})
			for key := range fieldSet {
				if label == key {
					return label, value, nil
				}
			}
			return "", "", fmt.Errorf("field label not supported for %s: %s", scope.ScopeNodeResourceInfo.GroupVersionKind(), label)
		},
	)
	if err != nil {
		return err
	}

	templateKind := templategroup.Kind()
	templateGvk := templateKind.GroupVersionKind()
	err = scheme.AddFieldLabelConversionFunc(
		templateGvk,
		func(label, value string) (string, string, error) {
			fieldSet := templategroup.SelectableFields(&templategroup.TemplateGroup{})
			for key := range fieldSet {
				if label == key {
					return label, value, nil
				}
			}
			return "", "", fmt.Errorf("field label not supported for %s: %s", scope.ScopeNodeResourceInfo.GroupVersionKind(), label)
		},
	)
	if err != nil {
		return err
	}

	return nil
}

// Resource takes an unqualified resource and returns a Group qualified GroupResource
func Resource(resource string) schema.GroupResource {
	return SchemeGroupVersion.WithResource(resource).GroupResource()
}
