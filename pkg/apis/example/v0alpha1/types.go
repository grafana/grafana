package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type RuntimeInfo struct {
	metav1.TypeMeta `json:",inline"`

	StartupTime int64 `json:"startupTime,omitempty"`

	BuildVersion          string `json:"buildVersion,omitempty"`
	BuildCommit           string `json:"buildCommit,omitempty"`
	EnterpriseBuildCommit string `json:"enterpriseBuildCommit,omitempty"`
	BuildBranch           string `json:"buildBranch,omitempty"`
	BuildStamp            int64  `json:"buildStamp,omitempty"`
	IsEnterprise          bool   `json:"enterprise,omitempty"`
	Packaging             string `json:"packaging,omitempty"`
}
