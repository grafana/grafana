package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

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

	Items []TeamMember `json:"items"`
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
