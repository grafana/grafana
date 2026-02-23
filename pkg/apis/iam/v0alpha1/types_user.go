package v0alpha1

import metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type UserTeamList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []UserTeam `json:"items"`
}

type UserTeam struct {
	Title      string         `json:"title,omitempty"`
	TeamRef    TeamRef        `json:"teamRef,omitempty"`
	Permission TeamPermission `json:"permission,omitempty"`
}
