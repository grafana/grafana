// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type PluginInstallSpec struct {
	PluginID string                           `json:"pluginID"`
	Version  string                           `json:"version"`
	Source   *PluginInstallV0alpha1SpecSource `json:"source,omitempty"`
}

// NewPluginInstallSpec creates a new PluginInstallSpec object.
func NewPluginInstallSpec() *PluginInstallSpec {
	return &PluginInstallSpec{}
}

// +k8s:openapi-gen=true
type PluginInstallV0alpha1SpecSourceCdnOptions struct {
	BaseURL string `json:"baseURL"`
}

// NewPluginInstallV0alpha1SpecSourceCdnOptions creates a new PluginInstallV0alpha1SpecSourceCdnOptions object.
func NewPluginInstallV0alpha1SpecSourceCdnOptions() *PluginInstallV0alpha1SpecSourceCdnOptions {
	return &PluginInstallV0alpha1SpecSourceCdnOptions{}
}

// +k8s:openapi-gen=true
type PluginInstallV0alpha1SpecSourceUrlOptions struct {
	Url      string  `json:"url"`
	Checksum *string `json:"checksum,omitempty"`
}

// NewPluginInstallV0alpha1SpecSourceUrlOptions creates a new PluginInstallV0alpha1SpecSourceUrlOptions object.
func NewPluginInstallV0alpha1SpecSourceUrlOptions() *PluginInstallV0alpha1SpecSourceUrlOptions {
	return &PluginInstallV0alpha1SpecSourceUrlOptions{}
}

// +k8s:openapi-gen=true
type PluginInstallV0alpha1SpecSource struct {
	// catalog, cdn, or url
	Type           string                                     `json:"type"`
	CatalogOptions interface{}                                `json:"catalogOptions,omitempty"`
	CdnOptions     *PluginInstallV0alpha1SpecSourceCdnOptions `json:"cdnOptions,omitempty"`
	UrlOptions     *PluginInstallV0alpha1SpecSourceUrlOptions `json:"urlOptions,omitempty"`
}

// NewPluginInstallV0alpha1SpecSource creates a new PluginInstallV0alpha1SpecSource object.
func NewPluginInstallV0alpha1SpecSource() *PluginInstallV0alpha1SpecSource {
	return &PluginInstallV0alpha1SpecSource{
		Type: "catalog",
	}
}
