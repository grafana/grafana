package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	runtime "k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/apis"
)

const (
	GROUP      = "service.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

var RuntimeResourceInfo = apis.NewResourceInfo(GROUP, VERSION,
	"externalnames", "externalname", "ExternalName",
	func() runtime.Object { return &ExternalName{} },
	func() runtime.Object { return &ExternalNameList{} },
)

// +genclient
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ExternalName struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec ExternalNameSpec `json:"spec,omitempty"`
}

type ExternalNameSpec struct {
	Host string `json:"host,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ExternalNameList struct {
	metav1.TypeMeta `json:",inline"`
	// +optional
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []ExternalName `json:"items,omitempty"`
}
