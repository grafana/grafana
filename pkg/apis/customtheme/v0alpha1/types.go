package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const OpenAPIPrefix = "com.github.grafana.grafana.pkg.apis.customtheme.v0alpha1."

// +genclient
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type CustomTheme struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec CustomThemeSpec `json:"spec,omitempty"`
}

func (CustomTheme) OpenAPIModelName() string {
	return OpenAPIPrefix + "CustomTheme"
}

type CustomThemeSpec struct {
	// The theme JSON data
	ThemeJSON string `json:"themeJson"`
	// The UID of the user who created this theme. If empty, the theme is available globally.
	UserUID string `json:"userUid,omitempty"`
}

func (CustomThemeSpec) OpenAPIModelName() string {
	return OpenAPIPrefix + "CustomThemeSpec"
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type CustomThemeList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []CustomTheme `json:"items"`
}

func (CustomThemeList) OpenAPIModelName() string {
	return OpenAPIPrefix + "CustomThemeList"
}
