package v0alpha1

import (
	"github.com/grafana/authlib/claims"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type User struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec UserSpec `json:"spec,omitempty"`
}

type UserSpec struct {
	Name          string `json:"name,omitempty"`
	Login         string `json:"login,omitempty"`
	Email         string `json:"email,omitempty"`
	EmailVerified bool   `json:"emailVerified,omitempty"`
	Disabled      bool   `json:"disabled,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type UserList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []User `json:"items,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type Team struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec TeamSpec `json:"spec,omitempty"`
}

type TeamSpec struct {
	Title string `json:"name,omitempty"`
	Email string `json:"email,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type TeamList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []Team `json:"items,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ServiceAccount struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec ServiceAccountSpec `json:"spec,omitempty"`
}

type ServiceAccountSpec struct {
	Name          string `json:"name,omitempty"`
	Email         string `json:"email,omitempty"`
	EmailVerified bool   `json:"emailVerified,omitempty"`
	Disabled      bool   `json:"disabled,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ServiceAccountList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []ServiceAccount `json:"items,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type IdentityDisplayResults struct {
	metav1.TypeMeta `json:",inline"`

	// Request keys used to lookup the display value
	// +listType=set
	Keys []string `json:"keys"`

	// Matching items (the caller may need to remap from keys to results)
	// +listType=atomic
	Display []IdentityDisplay `json:"display"`

	// Input keys that were not useable
	// +listType=set
	InvalidKeys []string `json:"invalidKeys,omitempty"`
}

type IdentityDisplay struct {
	IdentityType claims.IdentityType `json:"type"` // The namespaced UID, eg `user|api-key|...`
	UID          string              `json:"uid"`  // The namespaced UID, eg `xyz`
	Display      string              `json:"display"`
	AvatarURL    string              `json:"avatarURL,omitempty"`

	// Legacy internal ID -- usage of this value should be phased out
	InternalID int64 `json:"internalId,omitempty"`
}
