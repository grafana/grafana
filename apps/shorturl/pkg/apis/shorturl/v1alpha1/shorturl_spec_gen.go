// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type ShortURLSpec struct {
	// The original path to where the short url is linking too e.g. https://localhost:3000/eer8i1kictngga/new-dashboard-with-lib-panel
	Path string `json:"path"`
	// The random string that is used as part of the generated short URL. e.g. l356YhwHg
	Uid string `json:"uid"`
	// The last time the short URL was used, 0 is the initial value
	LastSeenAt int64 `json:"lastSeenAt"`
	// The actual short URL that is generated e.g. https://localhost:3000/goto/l356YhwHg?orgId=1
	ShortURL string `json:"shortURL"`
}

// NewShortURLSpec creates a new ShortURLSpec object.
func NewShortURLSpec() *ShortURLSpec {
	return &ShortURLSpec{}
}
