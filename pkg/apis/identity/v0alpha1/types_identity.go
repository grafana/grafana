package v0alpha1

import (
	"github.com/grafana/authlib/claims"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

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
