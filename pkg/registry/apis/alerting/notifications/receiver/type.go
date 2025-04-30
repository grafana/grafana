package receiver

import (
	"fmt"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/receiver/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

var kind = model.Kind()
var GetOpenAPIDefinitions = model.GetOpenAPIDefinitions
var ResourceInfo = utils.NewResourceInfo(kind.Group(), kind.Version(),
	kind.GroupVersionResource().Resource, strings.ToLower(kind.Kind()), kind.Kind(),
	func() runtime.Object { return kind.ZeroValue() },
	func() runtime.Object { return kind.ZeroListValue() },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Title", Type: "string", Format: "string", Description: "The receiver name"}, // TODO: Add integration types.
		},
		Reader: func(obj any) ([]interface{}, error) {
			r, ok := obj.(*model.Receiver)
			if ok {
				return []interface{}{
					r.Name,
					r.Spec.Title,
					// r.Spec, //TODO implement formatting for Spec, same as UI?
				}, nil
			}
			return nil, fmt.Errorf("expected resource or info")
		},
	},
)

func AddKnownTypes(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(ResourceInfo.GroupVersion(),
		&model.Receiver{},
		&model.ReceiverList{},
	)
	metav1.AddToGroupVersion(scheme, ResourceInfo.GroupVersion())

	err := scheme.AddFieldLabelConversionFunc(
		ResourceInfo.GroupVersionKind(),
		func(label, value string) (string, string, error) {
			fieldSet := model.SelectableFields(&model.Receiver{})
			for key := range fieldSet {
				if label == key {
					return label, value, nil
				}
			}
			return "", "", fmt.Errorf("field label not supported for %s: %s", ResourceInfo.GroupVersionKind(), label)
		},
	)
	if err != nil {
		return err
	}
	return nil
}
