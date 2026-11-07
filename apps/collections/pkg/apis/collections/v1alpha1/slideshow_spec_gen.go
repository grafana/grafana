// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1alpha1

// +k8s:openapi-gen=true
type SlideshowItem struct {
	// API group of the object, e.g. dashboard.grafana.app
	Group string `json:"group"`
	// Resource (plural) of the object, e.g. dashboards
	Resource string `json:"resource"`
	// The k8s name of the object
	Name string `json:"name"`
	// Optional per-item display interval (e.g. "30s", "2m"). When unset, the
	// slideshow's spec.interval is used.
	Interval *string `json:"interval,omitempty"`
}

// NewSlideshowItem creates a new SlideshowItem object.
func NewSlideshowItem() *SlideshowItem {
	return &SlideshowItem{}
}

// OpenAPIModelName returns the OpenAPI model name for SlideshowItem.
func (SlideshowItem) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.collections.pkg.apis.collections.v1alpha1.SlideshowItem"
}

// +k8s:openapi-gen=true
type SlideshowSpec struct {
	Title string `json:"title"`
	// How long each item is shown, e.g. "5m"
	Interval string `json:"interval"`
	// Played in order
	// +listType=atomic
	Items []SlideshowItem `json:"items"`
}

// NewSlideshowSpec creates a new SlideshowSpec object.
func NewSlideshowSpec() *SlideshowSpec {
	return &SlideshowSpec{
		Items: []SlideshowItem{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for SlideshowSpec.
func (SlideshowSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.collections.pkg.apis.collections.v1alpha1.SlideshowSpec"
}
