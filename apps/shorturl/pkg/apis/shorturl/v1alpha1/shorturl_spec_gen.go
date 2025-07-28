// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type ShortURLSpec struct {
	Path       string `json:"path"`
	Uid        string `json:"uid"`
	LastSeenAt int64  `json:"lastSeenAt"`
	ShortURL   string `json:"shortURL"`
}

// NewShortURLSpec creates a new ShortURLSpec object.
func NewShortURLSpec() *ShortURLSpec {
	return &ShortURLSpec{}
}
