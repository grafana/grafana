package v0alpha1

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	runtime "k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// Each check has its own resource info, multiple checks can reuse the same resource info if they are related
// E.g. all the datasource related checks (e.g. wrong UID, failing healthcheck, etc) are under this resource.
var DatasourceCheckResourceInfo = utils.NewResourceInfo(GROUP, VERSION,
	"datasourcecheck", "datasource-check", "DatasourceCheck",
	func() runtime.Object { return &DatasourceCheck{} },
	func() runtime.Object { return &DatasourceCheckList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Data", Type: "string"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			m, ok := obj.(*DatasourceCheck)
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
type DatasourceCheck struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec DatasourceCheckSpec `json:"spec,omitempty"`

	Status DatasourceCheckStatus `json:"status,omitempty"`
}

type DatasourceCheckSpec struct {
	// Data is currently unused but this can be used to add user inputs to the check.
	Data map[string]string `json:"data"`
}

type CheckError struct {
	Type   string `json:"type"`   // Investigation or Action recommended
	Reason string `json:"reason"` // Why the check is failing
	Action string `json:"action"` // Call to action
}

type DatasourceCheckStatus struct {
	Count  int          `json:"count"`  // Number of Datasources analyzed
	Errors []CheckError `json:"errors"` // List of errors found
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DatasourceCheckList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []DatasourceCheck `json:"items,omitempty"`
}
