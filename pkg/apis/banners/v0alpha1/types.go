package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type AnnouncementBanner struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec Spec `json:"spec,omitempty"`
}

// Type of the item.
// +enum
type BannerVariant string

// Defines values for BannerVarient.
const (
	BannerVariantInfo    BannerVariant = "info"
	BannerVariantWarning BannerVariant = "warning"
	BannerVariantError   BannerVariant = "error"
)

// Type of the item.
// +enum
type BannerVisibility string

// Defines values for BannerVisibility.
const (
	BannerVisibilityEveryone      BannerVisibility = "everyone"
	BannerVisibilityAuthenticated BannerVisibility = "authenticated"
)

type Spec struct {
	// Banner content (markdown)
	Message string `json:"message"`

	// Should this be shown
	Enabled bool `json:"enabled"`

	// When to start showing the banner
	StartTime *metav1.Time `json:"startTime,omitempty"`

	// When to stop showing the banner
	EndTime *metav1.Time `json:"endTime,omitempty"`

	// A type of banner
	Variant BannerVariant `json:"variant"`

	// Who can see this
	Visibility BannerVisibility `json:"visibility"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type AnnouncementBannerList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []AnnouncementBanner `json:"items,omitempty"`
}
