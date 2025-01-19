package v0alpha1

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	runtime "k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func init() {
	types = append(types, &PluginCheck{}, &PluginCheckList{})
}

var PluginCheckResourceInfo = utils.NewResourceInfo(GROUP, VERSION,
	"plugincheck", "plugin-check", "PluginCheck",
	func() runtime.Object { return &PluginCheck{} },
	func() runtime.Object { return &PluginCheckList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Data", Type: "string"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			m, ok := obj.(*PluginCheck)
			if !ok {
				return nil, fmt.Errorf("plugin-storage")
			}
			return []interface{}{
				m.Name,
				m.Spec.Data,
				m.CreationTimestamp.UTC().Format(time.RFC3339),
			}, nil
		},
	}, // default table converter
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type PluginCheck struct {
	GenericCheck `json:",inline"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type PluginCheckList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []PluginCheck `json:"items,omitempty"`
}
