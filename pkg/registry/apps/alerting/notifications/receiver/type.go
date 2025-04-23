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
