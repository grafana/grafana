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
	// Type of identity e.g. "user".
	// For a full list see https://github.com/grafana/authlib/blob/2f8d13a83ca3e82da08b53726de1697ee5b5b4cc/claims/type.go#L15-L24
	IdentityType claims.IdentityType `json:"type"`

	// UID for identity, is a unique value for the type within a namespace.
	UID string `json:"uid"`

	// Display name for identity.
	Display string `json:"display"`

	// AvatarURL is the url where we can get the avatar for identity
	AvatarURL string `json:"avatarURL,omitempty"`

	// InternalID is the legacy numreric id for identity, this is deprecated and should be phased out
	InternalID int64 `json:"internalId,omitempty"`
}
