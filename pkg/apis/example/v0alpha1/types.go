package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// Mirrors the info exposed in "github.com/grafana/grafana/pkg/setting"
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type RuntimeInfo struct {
	metav1.TypeMeta `json:",inline"`

	// Unix timestamp when the process started
	StartupTime int64 `json:"startupTime,omitempty"`

	BuildVersion          string `json:"buildVersion,omitempty"`
	BuildCommit           string `json:"buildCommit,omitempty"`
	EnterpriseBuildCommit string `json:"enterpriseBuildCommit,omitempty"`
	BuildBranch           string `json:"buildBranch,omitempty"`
	BuildStamp            int64  `json:"buildStamp,omitempty"`
	IsEnterprise          bool   `json:"enterprise,omitempty"`
	Packaging             string `json:"packaging,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DummyResource struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec common.Unstructured `json:"spec,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DummyResourceList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []DummyResource `json:"items,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DummySubresource struct {
	metav1.TypeMeta `json:",inline"`

	// add subresource info here
	Info string `json:"info,omitempty"`
}
