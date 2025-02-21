package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	claims "github.com/grafana/authlib/types"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DisplayList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	// Request keys used to lookup the display value
	// +listType=set
	Keys []string `json:"keys"`

	// Input keys that were not useable
	// +listType=set
	InvalidKeys []string `json:"invalidKeys,omitempty"`

	// Matching items (the caller may need to remap from keys to results)
	// +listType=atomic
	Items []Display `json:"display"`
}

type Display struct {
	Identity IdentityRef `json:"identity"`

	// Display name for identity.
	DisplayName string `json:"displayName"`

	// AvatarURL is the url where we can get the avatar for identity
	AvatarURL string `json:"avatarURL,omitempty"`

	// InternalID is the legacy numeric id for identity,
	// Deprecated: use the identityRef where possible
	InternalID int64 `json:"internalId,omitempty"`
}

type IdentityRef struct {
	// Type of identity e.g. "user".
	// For a full list see https://github.com/grafana/authlib/blob/d6737a7dc8f55e9d42834adb83b5da607ceed293/types/type.go#L15
	Type claims.IdentityType `json:"type"`

	// Name is the unique identifier for identity, guaranteed to be a unique value for the type within a namespace.
	Name string `json:"name"`
}

func (i *IdentityRef) String() string {
	return claims.NewTypeID(i.Type, i.Name)
}
