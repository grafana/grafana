package v2beta1

import metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

const DashboardPreferencesMergedKind = "DashboardPreferencesMerged"

// DashboardPreferencesMerged is what a new dashboard in a folder starts from. It is computed on request
// and never stored.
type DashboardPreferencesMerged struct {
	metav1.TypeMeta `json:",inline"`
	// Only the fields some tier set. A field that is absent uses Grafana's built-in default.
	Spec DashboardPreferencesMergedSpec `json:"spec"`
	// Where each field came from, keyed by its path as in spec.reset, such as "panels.legend.placement".
	// A field with no entry uses Grafana's built-in default.
	Sources map[string]DashboardPreferencesMergedSource `json:"sources"`
}

func (DashboardPreferencesMerged) OpenAPIModelName() string {
	return OpenAPIPrefix + "DashboardPreferencesMerged"
}

// The stored spec without reset: a merged spec is resolved, so nothing in it is reset.
type DashboardPreferencesMergedSpec struct {
	Dashboard *DashboardPreferencesDashboardDefaults `json:"dashboard,omitempty"`
	Panels    *DashboardPreferencesPanelDefaults     `json:"panels,omitempty"`
}

func (DashboardPreferencesMergedSpec) OpenAPIModelName() string {
	return OpenAPIPrefix + "DashboardPreferencesMergedSpec"
}

// +enum
type DashboardPreferencesMergedTier string

const (
	DashboardPreferencesMergedTierOrg    DashboardPreferencesMergedTier = "org"
	DashboardPreferencesMergedTierFolder DashboardPreferencesMergedTier = "folder"
	DashboardPreferencesMergedTierUser   DashboardPreferencesMergedTier = "user"
)

type DashboardPreferencesMergedSource struct {
	Tier DashboardPreferencesMergedTier `json:"tier"`
	// The tier object's name. Left out for a parent folder the caller can't read.
	Name string `json:"name,omitempty"`
	// The tier reset the field to Grafana's built-in default, so it is absent from spec.
	Reset bool `json:"reset,omitempty"`
}

func (DashboardPreferencesMergedSource) OpenAPIModelName() string {
	return OpenAPIPrefix + "DashboardPreferencesMergedSource"
}
