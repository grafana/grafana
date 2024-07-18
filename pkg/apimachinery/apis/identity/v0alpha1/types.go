package v0alpha1

import (
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
type IdentityDisplayList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []IdentityDisplay `json:"items,omitempty"`
}

type IdentityDisplay struct {
	IdentityType string `json:"type"` // The namespaced UID, eg `user|api-key|...`
	UID          string `json:"uid"`  // The namespaced UID, eg `xyz`
	Display      string `json:"display"`
	AvatarURL    string `json:"avatarURL,omitempty"`

	// Legacy internal ID -- usage of this value should be phased out
	LegacyID int64 `json:"legacyId,omitempty"`
}
