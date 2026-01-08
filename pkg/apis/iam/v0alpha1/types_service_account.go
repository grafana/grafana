package v0alpha1

import metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ServiceAccountTokenList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []ServiceAccountToken `json:"items"`
}

type ServiceAccountToken struct {
	Name     string       `json:"name,omitempty"`
	Revoked  bool         `json:"revoked,omitempty"`
	Expires  *metav1.Time `json:"expires,omitempty"`
	LastUsed *metav1.Time `json:"lastUsed,omitempty"`
	Created  metav1.Time  `json:"created"`
}
