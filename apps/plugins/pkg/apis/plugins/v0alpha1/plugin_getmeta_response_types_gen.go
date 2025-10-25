// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	time "time"
)

// +k8s:openapi-gen=true
type Info struct {
	// Required fields
	// +listType=set
	Keywords []string          `json:"keywords"`
	Logos    V0alpha1InfoLogos `json:"logos"`
	Updated  time.Time         `json:"updated"`
	Version  string            `json:"version"`
	// Optional fields
	Author      *V0alpha1InfoAuthor `json:"author,omitempty"`
	Description *string             `json:"description,omitempty"`
	// +listType=atomic
	Links []V0alpha1InfoLinks `json:"links,omitempty"`
	// +listType=atomic
	Screenshots []V0alpha1InfoScreenshots `json:"screenshots,omitempty"`
}

// NewInfo creates a new Info object.
func NewInfo() *Info {
	return &Info{
		Keywords: []string{},
		Logos:    *NewV0alpha1InfoLogos(),
	}
}

// +k8s:openapi-gen=true
type Dependencies struct {
	// Required field
	GrafanaDependency string `json:"grafanaDependency"`
	// Optional fields
	GrafanaVersion *string `json:"grafanaVersion,omitempty"`
	// +listType=set
	// +listMapKey=id
	Plugins    []V0alpha1DependenciesPlugins   `json:"plugins,omitempty"`
	Extensions *V0alpha1DependenciesExtensions `json:"extensions,omitempty"`
}

// NewDependencies creates a new Dependencies object.
func NewDependencies() *Dependencies {
	return &Dependencies{}
}

// +k8s:openapi-gen=true
type EnterpriseFeatures struct {
	// Allow additional properties
	HealthDiagnosticsErrors *bool `json:"healthDiagnosticsErrors,omitempty"`
}

// NewEnterpriseFeatures creates a new EnterpriseFeatures object.
func NewEnterpriseFeatures() *EnterpriseFeatures {
	return &EnterpriseFeatures{
		HealthDiagnosticsErrors: (func(input bool) *bool { return &input })(false),
	}
}

// +k8s:openapi-gen=true
type Include struct {
	Uid        *string      `json:"uid,omitempty"`
	Type       *IncludeType `json:"type,omitempty"`
	Name       *string      `json:"name,omitempty"`
	Component  *string      `json:"component,omitempty"`
	Role       *IncludeRole `json:"role,omitempty"`
	Action     *string      `json:"action,omitempty"`
	Path       *string      `json:"path,omitempty"`
	AddToNav   *bool        `json:"addToNav,omitempty"`
	DefaultNav *bool        `json:"defaultNav,omitempty"`
	Icon       *string      `json:"icon,omitempty"`
}

// NewInclude creates a new Include object.
func NewInclude() *Include {
	return &Include{}
}

// +k8s:openapi-gen=true
type QueryOptions struct {
	MaxDataPoints *bool `json:"maxDataPoints,omitempty"`
	MinInterval   *bool `json:"minInterval,omitempty"`
	CacheTimeout  *bool `json:"cacheTimeout,omitempty"`
}

// NewQueryOptions creates a new QueryOptions object.
func NewQueryOptions() *QueryOptions {
	return &QueryOptions{}
}

// +k8s:openapi-gen=true
type Route struct {
	Path        *string `json:"path,omitempty"`
	Method      *string `json:"method,omitempty"`
	Url         *string `json:"url,omitempty"`
	ReqSignedIn *bool   `json:"reqSignedIn,omitempty"`
	ReqRole     *string `json:"reqRole,omitempty"`
	ReqAction   *string `json:"reqAction,omitempty"`
	// +listType=atomic
	Headers      []string                   `json:"headers,omitempty"`
	Body         map[string]interface{}     `json:"body,omitempty"`
	TokenAuth    *V0alpha1RouteTokenAuth    `json:"tokenAuth,omitempty"`
	JwtTokenAuth *V0alpha1RouteJwtTokenAuth `json:"jwtTokenAuth,omitempty"`
	// +listType=atomic
	UrlParams []V0alpha1RouteUrlParams `json:"urlParams,omitempty"`
}

// NewRoute creates a new Route object.
func NewRoute() *Route {
	return &Route{}
}

// +k8s:openapi-gen=true
type IAM struct {
	// +listType=atomic
	Permissions []V0alpha1IAMPermissions `json:"permissions,omitempty"`
}

// NewIAM creates a new IAM object.
func NewIAM() *IAM {
	return &IAM{}
}

// +k8s:openapi-gen=true
type Role struct {
	Role *V0alpha1RoleRole `json:"role,omitempty"`
	// +listType=set
	Grants []string `json:"grants,omitempty"`
}

// NewRole creates a new Role object.
func NewRole() *Role {
	return &Role{}
}

// +k8s:openapi-gen=true
type Extensions struct {
	// +listType=atomic
	AddedComponents []V0alpha1ExtensionsAddedComponents `json:"addedComponents,omitempty"`
	// +listType=atomic
	AddedLinks []V0alpha1ExtensionsAddedLinks `json:"addedLinks,omitempty"`
	// +listType=set
	// +listMapKey=id
	ExposedComponents []V0alpha1ExtensionsExposedComponents `json:"exposedComponents,omitempty"`
	// +listType=set
	// +listMapKey=id
	ExtensionPoints []V0alpha1ExtensionsExtensionPoints `json:"extensionPoints,omitempty"`
}

// NewExtensions creates a new Extensions object.
func NewExtensions() *Extensions {
	return &Extensions{}
}

// +k8s:openapi-gen=true
type GetMeta struct {
	// Unique name of the plugin
	Id string `json:"id"`
	// Plugin type
	Type GetMetaType `json:"type"`
	// Human-readable name of the plugin
	Name string `json:"name"`
	// Metadata for the plugin
	Info Info `json:"info"`
	// Dependency information
	Dependencies Dependencies `json:"dependencies"`
	// Optional fields
	Alerting           *bool               `json:"alerting,omitempty"`
	Annotations        *bool               `json:"annotations,omitempty"`
	AutoEnabled        *bool               `json:"autoEnabled,omitempty"`
	Backend            *bool               `json:"backend,omitempty"`
	BuildMode          *string             `json:"buildMode,omitempty"`
	BuiltIn            *bool               `json:"builtIn,omitempty"`
	Category           *GetMetaCategory    `json:"category,omitempty"`
	EnterpriseFeatures *EnterpriseFeatures `json:"enterpriseFeatures,omitempty"`
	Executable         *string             `json:"executable,omitempty"`
	HideFromList       *bool               `json:"hideFromList,omitempty"`
	// +listType=atomic
	Includes                  []Include     `json:"includes,omitempty"`
	Logs                      *bool         `json:"logs,omitempty"`
	Metrics                   *bool         `json:"metrics,omitempty"`
	MultiValueFilterOperators *bool         `json:"multiValueFilterOperators,omitempty"`
	PascalName                *string       `json:"pascalName,omitempty"`
	Preload                   *bool         `json:"preload,omitempty"`
	QueryOptions              *QueryOptions `json:"queryOptions,omitempty"`
	// +listType=atomic
	Routes        []Route       `json:"routes,omitempty"`
	SkipDataQuery *bool         `json:"skipDataQuery,omitempty"`
	State         *GetMetaState `json:"state,omitempty"`
	Streaming     *bool         `json:"streaming,omitempty"`
	Tracing       *bool         `json:"tracing,omitempty"`
	Iam           *IAM          `json:"iam,omitempty"`
	// +listType=atomic
	Roles      []Role      `json:"roles,omitempty"`
	Extensions *Extensions `json:"extensions,omitempty"`
}

// NewGetMeta creates a new GetMeta object.
func NewGetMeta() *GetMeta {
	return &GetMeta{
		Info:         *NewInfo(),
		Dependencies: *NewDependencies(),
	}
}

// +k8s:openapi-gen=true
type V0alpha1InfoLogos struct {
	Small string `json:"small"`
	Large string `json:"large"`
}

// NewV0alpha1InfoLogos creates a new V0alpha1InfoLogos object.
func NewV0alpha1InfoLogos() *V0alpha1InfoLogos {
	return &V0alpha1InfoLogos{}
}

// +k8s:openapi-gen=true
type V0alpha1InfoAuthor struct {
	Name  *string `json:"name,omitempty"`
	Email *string `json:"email,omitempty"`
	Url   *string `json:"url,omitempty"`
}

// NewV0alpha1InfoAuthor creates a new V0alpha1InfoAuthor object.
func NewV0alpha1InfoAuthor() *V0alpha1InfoAuthor {
	return &V0alpha1InfoAuthor{}
}

// +k8s:openapi-gen=true
type V0alpha1InfoLinks struct {
	Name *string `json:"name,omitempty"`
	Url  *string `json:"url,omitempty"`
}

// NewV0alpha1InfoLinks creates a new V0alpha1InfoLinks object.
func NewV0alpha1InfoLinks() *V0alpha1InfoLinks {
	return &V0alpha1InfoLinks{}
}

// +k8s:openapi-gen=true
type V0alpha1InfoScreenshots struct {
	Name *string `json:"name,omitempty"`
	Path *string `json:"path,omitempty"`
}

// NewV0alpha1InfoScreenshots creates a new V0alpha1InfoScreenshots object.
func NewV0alpha1InfoScreenshots() *V0alpha1InfoScreenshots {
	return &V0alpha1InfoScreenshots{}
}

// +k8s:openapi-gen=true
type V0alpha1DependenciesPlugins struct {
	Id   string                          `json:"id"`
	Type V0alpha1DependenciesPluginsType `json:"type"`
	Name string                          `json:"name"`
}

// NewV0alpha1DependenciesPlugins creates a new V0alpha1DependenciesPlugins object.
func NewV0alpha1DependenciesPlugins() *V0alpha1DependenciesPlugins {
	return &V0alpha1DependenciesPlugins{}
}

// +k8s:openapi-gen=true
type V0alpha1DependenciesExtensions struct {
	// +listType=set
	ExposedComponents []string `json:"exposedComponents,omitempty"`
}

// NewV0alpha1DependenciesExtensions creates a new V0alpha1DependenciesExtensions object.
func NewV0alpha1DependenciesExtensions() *V0alpha1DependenciesExtensions {
	return &V0alpha1DependenciesExtensions{}
}

// +k8s:openapi-gen=true
type V0alpha1RouteTokenAuth struct {
	Url *string `json:"url,omitempty"`
	// +listType=set
	Scopes []string               `json:"scopes,omitempty"`
	Params map[string]interface{} `json:"params,omitempty"`
}

// NewV0alpha1RouteTokenAuth creates a new V0alpha1RouteTokenAuth object.
func NewV0alpha1RouteTokenAuth() *V0alpha1RouteTokenAuth {
	return &V0alpha1RouteTokenAuth{}
}

// +k8s:openapi-gen=true
type V0alpha1RouteJwtTokenAuth struct {
	Url *string `json:"url,omitempty"`
	// +listType=set
	Scopes []string               `json:"scopes,omitempty"`
	Params map[string]interface{} `json:"params,omitempty"`
}

// NewV0alpha1RouteJwtTokenAuth creates a new V0alpha1RouteJwtTokenAuth object.
func NewV0alpha1RouteJwtTokenAuth() *V0alpha1RouteJwtTokenAuth {
	return &V0alpha1RouteJwtTokenAuth{}
}

// +k8s:openapi-gen=true
type V0alpha1RouteUrlParams struct {
	Name    *string `json:"name,omitempty"`
	Content *string `json:"content,omitempty"`
}

// NewV0alpha1RouteUrlParams creates a new V0alpha1RouteUrlParams object.
func NewV0alpha1RouteUrlParams() *V0alpha1RouteUrlParams {
	return &V0alpha1RouteUrlParams{}
}

// +k8s:openapi-gen=true
type V0alpha1IAMPermissions struct {
	Action *string `json:"action,omitempty"`
	Scope  *string `json:"scope,omitempty"`
}

// NewV0alpha1IAMPermissions creates a new V0alpha1IAMPermissions object.
func NewV0alpha1IAMPermissions() *V0alpha1IAMPermissions {
	return &V0alpha1IAMPermissions{}
}

// +k8s:openapi-gen=true
type V0alpha1RoleRolePermissions struct {
	Action *string `json:"action,omitempty"`
	Scope  *string `json:"scope,omitempty"`
}

// NewV0alpha1RoleRolePermissions creates a new V0alpha1RoleRolePermissions object.
func NewV0alpha1RoleRolePermissions() *V0alpha1RoleRolePermissions {
	return &V0alpha1RoleRolePermissions{}
}

// +k8s:openapi-gen=true
type V0alpha1RoleRole struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	// +listType=atomic
	Permissions []V0alpha1RoleRolePermissions `json:"permissions,omitempty"`
}

// NewV0alpha1RoleRole creates a new V0alpha1RoleRole object.
func NewV0alpha1RoleRole() *V0alpha1RoleRole {
	return &V0alpha1RoleRole{}
}

// +k8s:openapi-gen=true
type V0alpha1ExtensionsAddedComponents struct {
	// +listType=set
	Targets     []string `json:"targets"`
	Title       string   `json:"title"`
	Description *string  `json:"description,omitempty"`
}

// NewV0alpha1ExtensionsAddedComponents creates a new V0alpha1ExtensionsAddedComponents object.
func NewV0alpha1ExtensionsAddedComponents() *V0alpha1ExtensionsAddedComponents {
	return &V0alpha1ExtensionsAddedComponents{
		Targets: []string{},
	}
}

// +k8s:openapi-gen=true
type V0alpha1ExtensionsAddedLinks struct {
	// +listType=set
	Targets     []string `json:"targets"`
	Title       string   `json:"title"`
	Description *string  `json:"description,omitempty"`
}

// NewV0alpha1ExtensionsAddedLinks creates a new V0alpha1ExtensionsAddedLinks object.
func NewV0alpha1ExtensionsAddedLinks() *V0alpha1ExtensionsAddedLinks {
	return &V0alpha1ExtensionsAddedLinks{
		Targets: []string{},
	}
}

// +k8s:openapi-gen=true
type V0alpha1ExtensionsExposedComponents struct {
	Id          string  `json:"id"`
	Title       *string `json:"title,omitempty"`
	Description *string `json:"description,omitempty"`
}

// NewV0alpha1ExtensionsExposedComponents creates a new V0alpha1ExtensionsExposedComponents object.
func NewV0alpha1ExtensionsExposedComponents() *V0alpha1ExtensionsExposedComponents {
	return &V0alpha1ExtensionsExposedComponents{}
}

// +k8s:openapi-gen=true
type V0alpha1ExtensionsExtensionPoints struct {
	Id          string  `json:"id"`
	Title       *string `json:"title,omitempty"`
	Description *string `json:"description,omitempty"`
}

// NewV0alpha1ExtensionsExtensionPoints creates a new V0alpha1ExtensionsExtensionPoints object.
func NewV0alpha1ExtensionsExtensionPoints() *V0alpha1ExtensionsExtensionPoints {
	return &V0alpha1ExtensionsExtensionPoints{}
}

// +k8s:openapi-gen=true
type IncludeType string

const (
	IncludeTypeDashboard  IncludeType = "dashboard"
	IncludeTypePage       IncludeType = "page"
	IncludeTypePanel      IncludeType = "panel"
	IncludeTypeDatasource IncludeType = "datasource"
)

// +k8s:openapi-gen=true
type IncludeRole string

const (
	IncludeRoleAdmin  IncludeRole = "Admin"
	IncludeRoleEditor IncludeRole = "Editor"
	IncludeRoleViewer IncludeRole = "Viewer"
)

// +k8s:openapi-gen=true
type GetMetaType string

const (
	GetMetaTypeApp        GetMetaType = "app"
	GetMetaTypeDatasource GetMetaType = "datasource"
	GetMetaTypePanel      GetMetaType = "panel"
	GetMetaTypeRenderer   GetMetaType = "renderer"
)

// +k8s:openapi-gen=true
type GetMetaCategory string

const (
	GetMetaCategoryTsdb       GetMetaCategory = "tsdb"
	GetMetaCategoryLogging    GetMetaCategory = "logging"
	GetMetaCategoryCloud      GetMetaCategory = "cloud"
	GetMetaCategoryTracing    GetMetaCategory = "tracing"
	GetMetaCategoryProfiling  GetMetaCategory = "profiling"
	GetMetaCategorySql        GetMetaCategory = "sql"
	GetMetaCategoryEnterprise GetMetaCategory = "enterprise"
	GetMetaCategoryIot        GetMetaCategory = "iot"
	GetMetaCategoryOther      GetMetaCategory = "other"
)

// +k8s:openapi-gen=true
type GetMetaState string

const (
	GetMetaStateAlpha GetMetaState = "alpha"
	GetMetaStateBeta  GetMetaState = "beta"
)

// +k8s:openapi-gen=true
type V0alpha1DependenciesPluginsType string

const (
	V0alpha1DependenciesPluginsTypeApp        V0alpha1DependenciesPluginsType = "app"
	V0alpha1DependenciesPluginsTypeDatasource V0alpha1DependenciesPluginsType = "datasource"
	V0alpha1DependenciesPluginsTypePanel      V0alpha1DependenciesPluginsType = "panel"
)
