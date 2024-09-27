package v0alpha1

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ServiceAccount struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec ServiceAccountSpec `json:"spec,omitempty"`
}

func (s ServiceAccount) AuthID() string {
	return fmt.Sprintf("%d", s.Spec.InternalID)
}

type ServiceAccountSpec struct {
	Title    string `json:"title,omitempty"`
	Disabled bool   `json:"disabled,omitempty"`
	// This is currently used for authorization checks but we don't want to expose it
	InternalID int64 `json:"-"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ServiceAccountList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []ServiceAccount `json:"items,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ServiceAccountTokenList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []ServiceAccountToken `json:"items,omitempty"`
}

type ServiceAccountToken struct {
	Name     string       `json:"name,omitempty"`
	Revoked  bool         `json:"revoked,omitempty"`
	Expires  *metav1.Time `json:"expires,omitempty"`
	LastUsed *metav1.Time `json:"lastUsed,omitempty"`
	Created  metav1.Time  `json:"created"`
}
