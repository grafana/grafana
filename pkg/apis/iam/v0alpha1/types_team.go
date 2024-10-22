package v0alpha1

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type Team struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec TeamSpec `json:"spec,omitempty"`
}

type TeamSpec struct {
	Title string `json:"title,omitempty"`
	Email string `json:"email,omitempty"`

	// This is currently used for authorization checks but we don't want to expose it
	InternalID int64 `json:"-"`
}

func (t Team) AuthID() string {
	return fmt.Sprintf("%d", t.Spec.InternalID)
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type TeamList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []Team `json:"items,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type TeamBinding struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec TeamBindingSpec `json:"spec,omitempty"`
}

type TeamBindingSpec struct {
	Subjects []TeamSubject `json:"subjects,omitempty"`
	Team     TeamRef       `json:"team,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type TeamBindingList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []TeamBinding `json:"items,omitempty"`
}

type TeamSubject struct {
	// Identity is a reference to the identity of this subject.
	Identity IdentityRef `json:"identity"`

	// Permission subject has in team.
	Permission TeamPermission `json:"permission,omitempty"`
}

type TeamRef struct {
	// Name is the unique identifier for a team.
	Name string `json:"name,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type TeamMemberList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []TeamMember `json:"items,omitempty"`
}

type TeamMember struct {
	Display `json:",inline"`

	// External is set if member ship was synced from external IDP.
	External bool `json:"external,omitempty"`
	// Permission member has in team.
	Permission TeamPermission `json:"permission,omitempty"`
}

// TeamPermission for subject
// +enum
type TeamPermission string

const (
	TeamPermissionAdmin  TeamPermission = "admin"
	TeamPermissionMember TeamPermission = "member"
)
