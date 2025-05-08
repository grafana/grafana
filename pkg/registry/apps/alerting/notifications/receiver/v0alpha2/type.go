package v0alpha2

import (
	"fmt"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	modelv2 "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/receiver/v0alpha2"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

var kindV2 = modelv2.Kind()

var ResourceInfo = utils.NewResourceInfo(kindV2.Group(), kindV2.Version(),
	kindV2.GroupVersionResource().Resource, strings.ToLower(kindV2.Kind()), kindV2.Kind(),
	func() runtime.Object { return kindV2.ZeroValue() },
	func() runtime.Object { return kindV2.ZeroListValue() },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Title", Type: "string", Format: "string", Description: "The receiver name"},
			{Name: "Integrations", Type: "string", Format: "string", Description: "The integration types"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			r, ok := obj.(*modelv2.Receiver)
			if ok {
				return []interface{}{
					r.Name,
					r.Spec.Title,
					strings.Join(r.Spec.GetIntegrationsTypes(), ","),
				}, nil
			}
			return nil, fmt.Errorf("expected resource or info")
		},
	},
)
