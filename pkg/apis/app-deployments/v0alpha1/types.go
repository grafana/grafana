package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type AppDeploymentInfo struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	// The dashboard body
	Spec Info `json:"spec,omitempty"`
}

type Info struct {
	Group   string     `json:"group,omitempty"`
	Version string     `json:"version,omitempty"`
	CDN     ChannelCDN `json:"cdn,omitempty"`

	// Additional versions that should be aggregated
	OldVersions []string `json:"old,omitempty"`
}

type ChannelCDN struct {
	// Grafana Updated every hour (M-F only!)
	Instant string `json:"instant,omitempty"`
	// Grafana Updated every week day
	Fast string `json:"fast,omitempty"`
	// Updated every week (Tues)
	Steady string `json:"steady,omitempty"`
	// Updated every month (4th monday of the month)
	Slow string `json:"slow,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type AppDeploymentInfoList struct {
	metav1.TypeMeta `json:",inline"`
	// +optional
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []AppDeploymentInfo `json:"items,omitempty"`
}
