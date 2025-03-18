package timeinterval

import (
	"fmt"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/resource/timeinterval/v0alpha1"
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
		},
		Reader: func(obj any) ([]interface{}, error) {
			r, ok := obj.(*model.TimeInterval)
			if !ok {
				return nil, fmt.Errorf("expected resource or info")
			}
			return []interface{}{
				r.Name,
			}, nil
		},
	},
)

func AddKnownTypes(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(ResourceInfo.GroupVersion(),
		&model.TimeInterval{},
		&model.TimeIntervalList{},
	)
	metav1.AddToGroupVersion(scheme, ResourceInfo.GroupVersion())

	err := scheme.AddFieldLabelConversionFunc(
		ResourceInfo.GroupVersionKind(),
		func(label, value string) (string, string, error) {
			fieldSet := model.SelectableFields(&model.TimeInterval{})
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
