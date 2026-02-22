package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

const OpenAPIPrefix = "com.github.grafana.grafana.pkg.apis.appplugin.v0alpha1."

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type Settings struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec SettingsSpec `json:"spec,omitempty"`
}

func (Settings) OpenAPIModelName() string {
	return OpenAPIPrefix + "Settings"
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type SettingsList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []Settings `json:"items"`
}

func (SettingsList) OpenAPIModelName() string {
	return OpenAPIPrefix + "SettingsList"
}

// Adapting Grafana's PluginSettings struct to the Kubernetes API
// Original at pkg/api/dtos/plugins.go.PluginSetting
type SettingsSpec struct {
	Name             string              `json:"name"`
	Type             string              `json:"type"`
	ID               string              `json:"id"`
	Enabled          bool                `json:"enabled"`
	Pinned           bool                `json:"pinned"`
	AutoEnabled      bool                `json:"autoEnabled"`
	Module           string              `json:"module"`
	BaseURL          string              `json:"baseUrl"`
	Info             PluginInfo          `json:"info"`
	Includes         []*PluginInclude    `json:"includes"`
	Dependencies     PluginDeps          `json:"dependencies"`
	Extensions       PluginExtensions    `json:"extensions"`
	JsonData         common.Unstructured `json:"jsonData"`
	SecureJsonFields map[string]bool     `json:"secureJsonFields"`
	DefaultNavURL    string              `json:"defaultNavUrl"`
	LatestVersion    string              `json:"latestVersion"`
	HasUpdate        bool                `json:"hasUpdate"`
	State            string              `json:"state"`
	Signature        string              `json:"signature"`
	SignatureType    string              `json:"signatureType"`
	SignatureOrg     string              `json:"signatureOrg"`
	AngularDetected  bool                `json:"angularDetected"`
	LoadingStrategy  string              `json:"loadingStrategy"`
	ModuleHash       string              `json:"moduleHash,omitempty"`
	Translations     map[string]string   `json:"translations,omitempty"`
}

func (SettingsSpec) OpenAPIModelName() string {
	return OpenAPIPrefix + "SettingsSpec"
}

type PluginInfo struct {
	Author      PluginInfoLink     `json:"author"`
	Description string             `json:"description"`
	Links       []PluginInfoLink   `json:"links"`
	Logos       PluginLogos        `json:"logos"`
	Build       PluginBuildInfo    `json:"build"`
	Screenshots []PluginScreenshot `json:"screenshots"`
	Version     string             `json:"version"`
	Updated     string             `json:"updated"`
	Keywords    []string           `json:"keywords"`
}

func (PluginInfo) OpenAPIModelName() string {
	return OpenAPIPrefix + "PluginInfo"
}

type PluginInfoLink struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

func (PluginInfoLink) OpenAPIModelName() string {
	return OpenAPIPrefix + "PluginInfoLink"
}

type PluginLogos struct {
	Small string `json:"small"`
	Large string `json:"large"`
}

func (PluginLogos) OpenAPIModelName() string {
	return OpenAPIPrefix + "PluginLogos"
}

type PluginBuildInfo struct {
	Time int64 `json:"time,omitempty"`
}

func (PluginBuildInfo) OpenAPIModelName() string {
	return OpenAPIPrefix + "PluginBuildInfo"
}

type PluginScreenshot struct {
	Name string `json:"name"`
	Path string `json:"path"`
}

func (PluginScreenshot) OpenAPIModelName() string {
	return OpenAPIPrefix + "PluginScreenshot"
}

type PluginInclude struct {
	Name       string `json:"name"`
	Path       string `json:"path"`
	Type       string `json:"type"`
	Component  string `json:"component"`
	Role       string `json:"role"`
	Action     string `json:"action,omitempty"`
	AddToNav   bool   `json:"addToNav"`
	DefaultNav bool   `json:"defaultNav"`
	Slug       string `json:"slug"`
	Icon       string `json:"icon"`
	UID        string `json:"uid"`
}

func (PluginInclude) OpenAPIModelName() string {
	return OpenAPIPrefix + "PluginInclude"
}

type PluginDeps struct {
	GrafanaDependency string             `json:"grafanaDependency"`
	GrafanaVersion    string             `json:"grafanaVersion"`
	Plugins           []PluginDependency `json:"plugins"`
	Extensions        ExtensionsDeps     `json:"extensions"`
}

func (PluginDeps) OpenAPIModelName() string {
	return OpenAPIPrefix + "PluginDeps"
}

type ExtensionsDeps struct {
	ExposedComponents []string `json:"exposedComponents"`
}

func (ExtensionsDeps) OpenAPIModelName() string {
	return OpenAPIPrefix + "ExtensionsDeps"
}

type PluginDependency struct {
	ID   string `json:"id"`
	Type string `json:"type"`
	Name string `json:"name"`
}

func (PluginDependency) OpenAPIModelName() string {
	return OpenAPIPrefix + "PluginDependency"
}

type PluginExtensions struct {
	AddedLinks        []PluginExtensionLink      `json:"addedLinks"`
	AddedComponents   []PluginExtensionComponent `json:"addedComponents"`
	ExposedComponents []PluginExposedComponent   `json:"exposedComponents"`
	ExtensionPoints   []PluginExtensionPoint     `json:"extensionPoints"`
	AddedFunctions    []PluginExtensionFunction  `json:"addedFunctions"`
}

func (PluginExtensions) OpenAPIModelName() string {
	return OpenAPIPrefix + "PluginExtensions"
}

type PluginExtensionLink struct {
	Targets     []string `json:"targets"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
}

func (PluginExtensionLink) OpenAPIModelName() string {
	return OpenAPIPrefix + "PluginExtensionLink"
}

type PluginExtensionComponent struct {
	Targets     []string `json:"targets"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
}

func (PluginExtensionComponent) OpenAPIModelName() string {
	return OpenAPIPrefix + "PluginExtensionComponent"
}

type PluginExposedComponent struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
}

func (PluginExposedComponent) OpenAPIModelName() string {
	return OpenAPIPrefix + "PluginExposedComponent"
}

type PluginExtensionPoint struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
}

func (PluginExtensionPoint) OpenAPIModelName() string {
	return OpenAPIPrefix + "PluginExtensionPoint"
}

type PluginExtensionFunction struct {
	Targets     []string `json:"targets"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
}

func (PluginExtensionFunction) OpenAPIModelName() string {
	return OpenAPIPrefix + "PluginExtensionFunction"
}
