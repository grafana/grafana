// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	time "time"
)

// JSON configuration schema for Grafana plugins
// Converted from: https://github.com/grafana/grafana/blob/main/docs/sources/developers/plugins/plugin.schema.json
// +k8s:openapi-gen=true
type PluginMetaJSONData struct {
	// Unique name of the plugin
	Id string `json:"id"`
	// Plugin type
	Type PluginMetaJSONDataType `json:"type"`
	// Human-readable name of the plugin
	Name string `json:"name"`
	// Metadata for the plugin
	Info PluginMetaInfo `json:"info"`
	// Dependency information
	Dependencies PluginMetaDependencies `json:"dependencies"`
	// Optional fields
	Alerting           *bool                         `json:"alerting,omitempty"`
	Annotations        *bool                         `json:"annotations,omitempty"`
	AutoEnabled        *bool                         `json:"autoEnabled,omitempty"`
	Backend            *bool                         `json:"backend,omitempty"`
	BuildMode          *string                       `json:"buildMode,omitempty"`
	BuiltIn            *bool                         `json:"builtIn,omitempty"`
	Category           *PluginMetaJSONDataCategory   `json:"category,omitempty"`
	EnterpriseFeatures *PluginMetaEnterpriseFeatures `json:"enterpriseFeatures,omitempty"`
	Executable         *string                       `json:"executable,omitempty"`
	HideFromList       *bool                         `json:"hideFromList,omitempty"`
	// +listType=atomic
	Includes                  []PluginMetaInclude     `json:"includes,omitempty"`
	Logs                      *bool                   `json:"logs,omitempty"`
	Metrics                   *bool                   `json:"metrics,omitempty"`
	MultiValueFilterOperators *bool                   `json:"multiValueFilterOperators,omitempty"`
	PascalName                *string                 `json:"pascalName,omitempty"`
	Preload                   *bool                   `json:"preload,omitempty"`
	QueryOptions              *PluginMetaQueryOptions `json:"queryOptions,omitempty"`
	// +listType=atomic
	Routes        []PluginMetaRoute        `json:"routes,omitempty"`
	SkipDataQuery *bool                    `json:"skipDataQuery,omitempty"`
	State         *PluginMetaJSONDataState `json:"state,omitempty"`
	Streaming     *bool                    `json:"streaming,omitempty"`
	Tracing       *bool                    `json:"tracing,omitempty"`
	Iam           *PluginMetaIAM           `json:"iam,omitempty"`
	// +listType=atomic
	Roles      []PluginMetaRole      `json:"roles,omitempty"`
	Extensions *PluginMetaExtensions `json:"extensions,omitempty"`
}

// NewPluginMetaJSONData creates a new PluginMetaJSONData object.
func NewPluginMetaJSONData() *PluginMetaJSONData {
	return &PluginMetaJSONData{
		Info:         *NewPluginMetaInfo(),
		Dependencies: *NewPluginMetaDependencies(),
	}
}

// +k8s:openapi-gen=true
type PluginMetaInfo struct {
	// Required fields
	// +listType=set
	Keywords []string                    `json:"keywords"`
	Logos    PluginMetaV0alpha1InfoLogos `json:"logos"`
	Updated  time.Time                   `json:"updated"`
	Version  string                      `json:"version"`
	// Optional fields
	Author      *PluginMetaV0alpha1InfoAuthor `json:"author,omitempty"`
	Description *string                       `json:"description,omitempty"`
	// +listType=atomic
	Links []PluginMetaV0alpha1InfoLinks `json:"links,omitempty"`
	// +listType=atomic
	Screenshots []PluginMetaV0alpha1InfoScreenshots `json:"screenshots,omitempty"`
}

// NewPluginMetaInfo creates a new PluginMetaInfo object.
func NewPluginMetaInfo() *PluginMetaInfo {
	return &PluginMetaInfo{
		Keywords: []string{},
		Logos:    *NewPluginMetaV0alpha1InfoLogos(),
	}
}

// +k8s:openapi-gen=true
type PluginMetaDependencies struct {
	// Required field
	GrafanaDependency string `json:"grafanaDependency"`
	// Optional fields
	GrafanaVersion *string `json:"grafanaVersion,omitempty"`
	// +listType=set
	// +listMapKey=id
	Plugins    []PluginMetaV0alpha1DependenciesPlugins   `json:"plugins,omitempty"`
	Extensions *PluginMetaV0alpha1DependenciesExtensions `json:"extensions,omitempty"`
}

// NewPluginMetaDependencies creates a new PluginMetaDependencies object.
func NewPluginMetaDependencies() *PluginMetaDependencies {
	return &PluginMetaDependencies{}
}

// +k8s:openapi-gen=true
type PluginMetaEnterpriseFeatures struct {
	// Allow additional properties
	HealthDiagnosticsErrors *bool `json:"healthDiagnosticsErrors,omitempty"`
}

// NewPluginMetaEnterpriseFeatures creates a new PluginMetaEnterpriseFeatures object.
func NewPluginMetaEnterpriseFeatures() *PluginMetaEnterpriseFeatures {
	return &PluginMetaEnterpriseFeatures{
		HealthDiagnosticsErrors: (func(input bool) *bool { return &input })(false),
	}
}

// +k8s:openapi-gen=true
type PluginMetaInclude struct {
	Uid        *string                `json:"uid,omitempty"`
	Type       *PluginMetaIncludeType `json:"type,omitempty"`
	Name       *string                `json:"name,omitempty"`
	Component  *string                `json:"component,omitempty"`
	Role       *PluginMetaIncludeRole `json:"role,omitempty"`
	Action     *string                `json:"action,omitempty"`
	Path       *string                `json:"path,omitempty"`
	AddToNav   *bool                  `json:"addToNav,omitempty"`
	DefaultNav *bool                  `json:"defaultNav,omitempty"`
	Icon       *string                `json:"icon,omitempty"`
}

// NewPluginMetaInclude creates a new PluginMetaInclude object.
func NewPluginMetaInclude() *PluginMetaInclude {
	return &PluginMetaInclude{}
}

// +k8s:openapi-gen=true
type PluginMetaQueryOptions struct {
	MaxDataPoints *bool `json:"maxDataPoints,omitempty"`
	MinInterval   *bool `json:"minInterval,omitempty"`
	CacheTimeout  *bool `json:"cacheTimeout,omitempty"`
}

// NewPluginMetaQueryOptions creates a new PluginMetaQueryOptions object.
func NewPluginMetaQueryOptions() *PluginMetaQueryOptions {
	return &PluginMetaQueryOptions{}
}

// +k8s:openapi-gen=true
type PluginMetaRoute struct {
	Path        *string `json:"path,omitempty"`
	Method      *string `json:"method,omitempty"`
	Url         *string `json:"url,omitempty"`
	ReqSignedIn *bool   `json:"reqSignedIn,omitempty"`
	ReqRole     *string `json:"reqRole,omitempty"`
	ReqAction   *string `json:"reqAction,omitempty"`
	// +listType=atomic
	Headers      []string                             `json:"headers,omitempty"`
	Body         map[string]interface{}               `json:"body,omitempty"`
	TokenAuth    *PluginMetaV0alpha1RouteTokenAuth    `json:"tokenAuth,omitempty"`
	JwtTokenAuth *PluginMetaV0alpha1RouteJwtTokenAuth `json:"jwtTokenAuth,omitempty"`
	// +listType=atomic
	UrlParams []PluginMetaV0alpha1RouteUrlParams `json:"urlParams,omitempty"`
}

// NewPluginMetaRoute creates a new PluginMetaRoute object.
func NewPluginMetaRoute() *PluginMetaRoute {
	return &PluginMetaRoute{}
}

// +k8s:openapi-gen=true
type PluginMetaIAM struct {
	// +listType=atomic
	Permissions []PluginMetaV0alpha1IAMPermissions `json:"permissions,omitempty"`
}

// NewPluginMetaIAM creates a new PluginMetaIAM object.
func NewPluginMetaIAM() *PluginMetaIAM {
	return &PluginMetaIAM{}
}

// +k8s:openapi-gen=true
type PluginMetaRole struct {
	Role *PluginMetaV0alpha1RoleRole `json:"role,omitempty"`
	// +listType=set
	Grants []string `json:"grants,omitempty"`
}

// NewPluginMetaRole creates a new PluginMetaRole object.
func NewPluginMetaRole() *PluginMetaRole {
	return &PluginMetaRole{}
}

// +k8s:openapi-gen=true
type PluginMetaExtensions struct {
	// +listType=atomic
	AddedComponents []PluginMetaV0alpha1ExtensionsAddedComponents `json:"addedComponents,omitempty"`
	// +listType=atomic
	AddedLinks []PluginMetaV0alpha1ExtensionsAddedLinks `json:"addedLinks,omitempty"`
	// +listType=set
	// +listMapKey=id
	ExposedComponents []PluginMetaV0alpha1ExtensionsExposedComponents `json:"exposedComponents,omitempty"`
	// +listType=set
	// +listMapKey=id
	ExtensionPoints []PluginMetaV0alpha1ExtensionsExtensionPoints `json:"extensionPoints,omitempty"`
}

// NewPluginMetaExtensions creates a new PluginMetaExtensions object.
func NewPluginMetaExtensions() *PluginMetaExtensions {
	return &PluginMetaExtensions{}
}

// +k8s:openapi-gen=true
type PluginMetaSpec struct {
	PluginJSON PluginMetaJSONData `json:"pluginJSON"`
}

// NewPluginMetaSpec creates a new PluginMetaSpec object.
func NewPluginMetaSpec() *PluginMetaSpec {
	return &PluginMetaSpec{
		PluginJSON: *NewPluginMetaJSONData(),
	}
}

// +k8s:openapi-gen=true
type PluginMetaV0alpha1InfoLogos struct {
	Small string `json:"small"`
	Large string `json:"large"`
}

// NewPluginMetaV0alpha1InfoLogos creates a new PluginMetaV0alpha1InfoLogos object.
func NewPluginMetaV0alpha1InfoLogos() *PluginMetaV0alpha1InfoLogos {
	return &PluginMetaV0alpha1InfoLogos{}
}

// +k8s:openapi-gen=true
type PluginMetaV0alpha1InfoAuthor struct {
	Name  *string `json:"name,omitempty"`
	Email *string `json:"email,omitempty"`
	Url   *string `json:"url,omitempty"`
}

// NewPluginMetaV0alpha1InfoAuthor creates a new PluginMetaV0alpha1InfoAuthor object.
func NewPluginMetaV0alpha1InfoAuthor() *PluginMetaV0alpha1InfoAuthor {
	return &PluginMetaV0alpha1InfoAuthor{}
}

// +k8s:openapi-gen=true
type PluginMetaV0alpha1InfoLinks struct {
	Name *string `json:"name,omitempty"`
	Url  *string `json:"url,omitempty"`
}

// NewPluginMetaV0alpha1InfoLinks creates a new PluginMetaV0alpha1InfoLinks object.
func NewPluginMetaV0alpha1InfoLinks() *PluginMetaV0alpha1InfoLinks {
	return &PluginMetaV0alpha1InfoLinks{}
}

// +k8s:openapi-gen=true
type PluginMetaV0alpha1InfoScreenshots struct {
	Name *string `json:"name,omitempty"`
	Path *string `json:"path,omitempty"`
}

// NewPluginMetaV0alpha1InfoScreenshots creates a new PluginMetaV0alpha1InfoScreenshots object.
func NewPluginMetaV0alpha1InfoScreenshots() *PluginMetaV0alpha1InfoScreenshots {
	return &PluginMetaV0alpha1InfoScreenshots{}
}

// +k8s:openapi-gen=true
type PluginMetaV0alpha1DependenciesPlugins struct {
	Id   string                                    `json:"id"`
	Type PluginMetaV0alpha1DependenciesPluginsType `json:"type"`
	Name string                                    `json:"name"`
}

// NewPluginMetaV0alpha1DependenciesPlugins creates a new PluginMetaV0alpha1DependenciesPlugins object.
func NewPluginMetaV0alpha1DependenciesPlugins() *PluginMetaV0alpha1DependenciesPlugins {
	return &PluginMetaV0alpha1DependenciesPlugins{}
}

// +k8s:openapi-gen=true
type PluginMetaV0alpha1DependenciesExtensions struct {
	// +listType=set
	ExposedComponents []string `json:"exposedComponents,omitempty"`
}

// NewPluginMetaV0alpha1DependenciesExtensions creates a new PluginMetaV0alpha1DependenciesExtensions object.
func NewPluginMetaV0alpha1DependenciesExtensions() *PluginMetaV0alpha1DependenciesExtensions {
	return &PluginMetaV0alpha1DependenciesExtensions{}
}

// +k8s:openapi-gen=true
type PluginMetaV0alpha1RouteTokenAuth struct {
	Url *string `json:"url,omitempty"`
	// +listType=set
	Scopes []string               `json:"scopes,omitempty"`
	Params map[string]interface{} `json:"params,omitempty"`
}

// NewPluginMetaV0alpha1RouteTokenAuth creates a new PluginMetaV0alpha1RouteTokenAuth object.
func NewPluginMetaV0alpha1RouteTokenAuth() *PluginMetaV0alpha1RouteTokenAuth {
	return &PluginMetaV0alpha1RouteTokenAuth{}
}

// +k8s:openapi-gen=true
type PluginMetaV0alpha1RouteJwtTokenAuth struct {
	Url *string `json:"url,omitempty"`
	// +listType=set
	Scopes []string               `json:"scopes,omitempty"`
	Params map[string]interface{} `json:"params,omitempty"`
}

// NewPluginMetaV0alpha1RouteJwtTokenAuth creates a new PluginMetaV0alpha1RouteJwtTokenAuth object.
func NewPluginMetaV0alpha1RouteJwtTokenAuth() *PluginMetaV0alpha1RouteJwtTokenAuth {
	return &PluginMetaV0alpha1RouteJwtTokenAuth{}
}

// +k8s:openapi-gen=true
type PluginMetaV0alpha1RouteUrlParams struct {
	Name    *string `json:"name,omitempty"`
	Content *string `json:"content,omitempty"`
}

// NewPluginMetaV0alpha1RouteUrlParams creates a new PluginMetaV0alpha1RouteUrlParams object.
func NewPluginMetaV0alpha1RouteUrlParams() *PluginMetaV0alpha1RouteUrlParams {
	return &PluginMetaV0alpha1RouteUrlParams{}
}

// +k8s:openapi-gen=true
type PluginMetaV0alpha1IAMPermissions struct {
	Action *string `json:"action,omitempty"`
	Scope  *string `json:"scope,omitempty"`
}

// NewPluginMetaV0alpha1IAMPermissions creates a new PluginMetaV0alpha1IAMPermissions object.
func NewPluginMetaV0alpha1IAMPermissions() *PluginMetaV0alpha1IAMPermissions {
	return &PluginMetaV0alpha1IAMPermissions{}
}

// +k8s:openapi-gen=true
type PluginMetaV0alpha1RoleRolePermissions struct {
	Action *string `json:"action,omitempty"`
	Scope  *string `json:"scope,omitempty"`
}

// NewPluginMetaV0alpha1RoleRolePermissions creates a new PluginMetaV0alpha1RoleRolePermissions object.
func NewPluginMetaV0alpha1RoleRolePermissions() *PluginMetaV0alpha1RoleRolePermissions {
	return &PluginMetaV0alpha1RoleRolePermissions{}
}

// +k8s:openapi-gen=true
type PluginMetaV0alpha1RoleRole struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	// +listType=atomic
	Permissions []PluginMetaV0alpha1RoleRolePermissions `json:"permissions,omitempty"`
}

// NewPluginMetaV0alpha1RoleRole creates a new PluginMetaV0alpha1RoleRole object.
func NewPluginMetaV0alpha1RoleRole() *PluginMetaV0alpha1RoleRole {
	return &PluginMetaV0alpha1RoleRole{}
}

// +k8s:openapi-gen=true
type PluginMetaV0alpha1ExtensionsAddedComponents struct {
	// +listType=set
	Targets     []string `json:"targets"`
	Title       string   `json:"title"`
	Description *string  `json:"description,omitempty"`
}

// NewPluginMetaV0alpha1ExtensionsAddedComponents creates a new PluginMetaV0alpha1ExtensionsAddedComponents object.
func NewPluginMetaV0alpha1ExtensionsAddedComponents() *PluginMetaV0alpha1ExtensionsAddedComponents {
	return &PluginMetaV0alpha1ExtensionsAddedComponents{
		Targets: []string{},
	}
}

// +k8s:openapi-gen=true
type PluginMetaV0alpha1ExtensionsAddedLinks struct {
	// +listType=set
	Targets     []string `json:"targets"`
	Title       string   `json:"title"`
	Description *string  `json:"description,omitempty"`
}

// NewPluginMetaV0alpha1ExtensionsAddedLinks creates a new PluginMetaV0alpha1ExtensionsAddedLinks object.
func NewPluginMetaV0alpha1ExtensionsAddedLinks() *PluginMetaV0alpha1ExtensionsAddedLinks {
	return &PluginMetaV0alpha1ExtensionsAddedLinks{
		Targets: []string{},
	}
}

// +k8s:openapi-gen=true
type PluginMetaV0alpha1ExtensionsExposedComponents struct {
	Id          string  `json:"id"`
	Title       *string `json:"title,omitempty"`
	Description *string `json:"description,omitempty"`
}

// NewPluginMetaV0alpha1ExtensionsExposedComponents creates a new PluginMetaV0alpha1ExtensionsExposedComponents object.
func NewPluginMetaV0alpha1ExtensionsExposedComponents() *PluginMetaV0alpha1ExtensionsExposedComponents {
	return &PluginMetaV0alpha1ExtensionsExposedComponents{}
}

// +k8s:openapi-gen=true
type PluginMetaV0alpha1ExtensionsExtensionPoints struct {
	Id          string  `json:"id"`
	Title       *string `json:"title,omitempty"`
	Description *string `json:"description,omitempty"`
}

// NewPluginMetaV0alpha1ExtensionsExtensionPoints creates a new PluginMetaV0alpha1ExtensionsExtensionPoints object.
func NewPluginMetaV0alpha1ExtensionsExtensionPoints() *PluginMetaV0alpha1ExtensionsExtensionPoints {
	return &PluginMetaV0alpha1ExtensionsExtensionPoints{}
}

// +k8s:openapi-gen=true
type PluginMetaJSONDataType string

const (
	PluginMetaJSONDataTypeApp        PluginMetaJSONDataType = "app"
	PluginMetaJSONDataTypeDatasource PluginMetaJSONDataType = "datasource"
	PluginMetaJSONDataTypePanel      PluginMetaJSONDataType = "panel"
	PluginMetaJSONDataTypeRenderer   PluginMetaJSONDataType = "renderer"
)

// +k8s:openapi-gen=true
type PluginMetaJSONDataCategory string

const (
	PluginMetaJSONDataCategoryTsdb       PluginMetaJSONDataCategory = "tsdb"
	PluginMetaJSONDataCategoryLogging    PluginMetaJSONDataCategory = "logging"
	PluginMetaJSONDataCategoryCloud      PluginMetaJSONDataCategory = "cloud"
	PluginMetaJSONDataCategoryTracing    PluginMetaJSONDataCategory = "tracing"
	PluginMetaJSONDataCategoryProfiling  PluginMetaJSONDataCategory = "profiling"
	PluginMetaJSONDataCategorySql        PluginMetaJSONDataCategory = "sql"
	PluginMetaJSONDataCategoryEnterprise PluginMetaJSONDataCategory = "enterprise"
	PluginMetaJSONDataCategoryIot        PluginMetaJSONDataCategory = "iot"
	PluginMetaJSONDataCategoryOther      PluginMetaJSONDataCategory = "other"
)

// +k8s:openapi-gen=true
type PluginMetaJSONDataState string

const (
	PluginMetaJSONDataStateAlpha PluginMetaJSONDataState = "alpha"
	PluginMetaJSONDataStateBeta  PluginMetaJSONDataState = "beta"
)

// +k8s:openapi-gen=true
type PluginMetaIncludeType string

const (
	PluginMetaIncludeTypeDashboard  PluginMetaIncludeType = "dashboard"
	PluginMetaIncludeTypePage       PluginMetaIncludeType = "page"
	PluginMetaIncludeTypePanel      PluginMetaIncludeType = "panel"
	PluginMetaIncludeTypeDatasource PluginMetaIncludeType = "datasource"
)

// +k8s:openapi-gen=true
type PluginMetaIncludeRole string

const (
	PluginMetaIncludeRoleAdmin  PluginMetaIncludeRole = "Admin"
	PluginMetaIncludeRoleEditor PluginMetaIncludeRole = "Editor"
	PluginMetaIncludeRoleViewer PluginMetaIncludeRole = "Viewer"
)

// +k8s:openapi-gen=true
type PluginMetaV0alpha1DependenciesPluginsType string

const (
	PluginMetaV0alpha1DependenciesPluginsTypeApp        PluginMetaV0alpha1DependenciesPluginsType = "app"
	PluginMetaV0alpha1DependenciesPluginsTypeDatasource PluginMetaV0alpha1DependenciesPluginsType = "datasource"
	PluginMetaV0alpha1DependenciesPluginsTypePanel      PluginMetaV0alpha1DependenciesPluginsType = "panel"
)
