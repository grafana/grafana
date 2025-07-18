// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// JSON configuration schema for Grafana plugins
// Converted from: https://github.com/grafana/grafana/blob/main/docs/sources/developers/plugins/plugin.schema.json
// +k8s:openapi-gen=true
type PluginJSONData struct {
	// Unique name of the plugin
	Id string `json:"id"`
	// Plugin type
	Type PluginJSONDataType `json:"type"`
	// Human-readable name of the plugin
	Name string `json:"name"`
	// Metadata for the plugin
	Info PluginInfo `json:"info"`
	// Dependency information
	Dependencies PluginDependencies `json:"dependencies"`
	// Optional fields
	Alerting           *bool                     `json:"alerting,omitempty"`
	Annotations        *bool                     `json:"annotations,omitempty"`
	AutoEnabled        *bool                     `json:"autoEnabled,omitempty"`
	Backend            *bool                     `json:"backend,omitempty"`
	BuildMode          *string                   `json:"buildMode,omitempty"`
	BuiltIn            *bool                     `json:"builtIn,omitempty"`
	Category           *PluginJSONDataCategory   `json:"category,omitempty"`
	EnterpriseFeatures *PluginEnterpriseFeatures `json:"enterpriseFeatures,omitempty"`
	Executable         *string                   `json:"executable,omitempty"`
	HideFromList       *bool                     `json:"hideFromList,omitempty"`
	// +listType=atomic
	Includes                  []PluginInclude     `json:"includes,omitempty"`
	Logs                      *bool               `json:"logs,omitempty"`
	Metrics                   *bool               `json:"metrics,omitempty"`
	MultiValueFilterOperators *bool               `json:"multiValueFilterOperators,omitempty"`
	PascalName                *string             `json:"pascalName,omitempty"`
	Preload                   *bool               `json:"preload,omitempty"`
	QueryOptions              *PluginQueryOptions `json:"queryOptions,omitempty"`
	// +listType=atomic
	Routes        []PluginRoute        `json:"routes,omitempty"`
	SkipDataQuery *bool                `json:"skipDataQuery,omitempty"`
	State         *PluginJSONDataState `json:"state,omitempty"`
	Streaming     *bool                `json:"streaming,omitempty"`
	Tracing       *bool                `json:"tracing,omitempty"`
	Iam           *PluginIAM           `json:"iam,omitempty"`
	// +listType=atomic
	Roles      []PluginRole      `json:"roles,omitempty"`
	Extensions *PluginExtensions `json:"extensions,omitempty"`
}

// NewPluginJSONData creates a new PluginJSONData object.
func NewPluginJSONData() *PluginJSONData {
	return &PluginJSONData{
		Info:         *NewPluginInfo(),
		Dependencies: *NewPluginDependencies(),
	}
}

// +k8s:openapi-gen=true
type PluginInfo struct {
	// Required fields
	// +listType=set
	Keywords []string                `json:"keywords"`
	Logos    PluginV0alpha1InfoLogos `json:"logos"`
	Updated  string                  `json:"updated"`
	Version  string                  `json:"version"`
	// Optional fields
	Author      *PluginV0alpha1InfoAuthor `json:"author,omitempty"`
	Build       *PluginV0alpha1InfoBuild  `json:"build,omitempty"`
	Description *string                   `json:"description,omitempty"`
	// +listType=atomic
	Links []PluginV0alpha1InfoLinks `json:"links,omitempty"`
	// +listType=atomic
	Screenshots []PluginV0alpha1InfoScreenshots `json:"screenshots,omitempty"`
}

// NewPluginInfo creates a new PluginInfo object.
func NewPluginInfo() *PluginInfo {
	return &PluginInfo{
		Keywords: []string{},
		Logos:    *NewPluginV0alpha1InfoLogos(),
	}
}

// +k8s:openapi-gen=true
type PluginDependencies struct {
	// Required field
	GrafanaDependency string `json:"grafanaDependency"`
	// Optional fields
	GrafanaVersion *string `json:"grafanaVersion,omitempty"`
	// +listType=set
	// +listMapKey=id
	Plugins    []PluginV0alpha1DependenciesPlugins   `json:"plugins,omitempty"`
	Extensions *PluginV0alpha1DependenciesExtensions `json:"extensions,omitempty"`
}

// NewPluginDependencies creates a new PluginDependencies object.
func NewPluginDependencies() *PluginDependencies {
	return &PluginDependencies{}
}

// +k8s:openapi-gen=true
type PluginEnterpriseFeatures struct {
	// Allow additional properties
	HealthDiagnosticsErrors *bool `json:"healthDiagnosticsErrors,omitempty"`
}

// NewPluginEnterpriseFeatures creates a new PluginEnterpriseFeatures object.
func NewPluginEnterpriseFeatures() *PluginEnterpriseFeatures {
	return &PluginEnterpriseFeatures{
		HealthDiagnosticsErrors: (func(input bool) *bool { return &input })(false),
	}
}

// +k8s:openapi-gen=true
type PluginInclude struct {
	Uid        *string            `json:"uid,omitempty"`
	Type       *PluginIncludeType `json:"type,omitempty"`
	Name       *string            `json:"name,omitempty"`
	Component  *string            `json:"component,omitempty"`
	Role       *PluginIncludeRole `json:"role,omitempty"`
	Action     *string            `json:"action,omitempty"`
	Path       *string            `json:"path,omitempty"`
	AddToNav   *bool              `json:"addToNav,omitempty"`
	DefaultNav *bool              `json:"defaultNav,omitempty"`
	Icon       *string            `json:"icon,omitempty"`
}

// NewPluginInclude creates a new PluginInclude object.
func NewPluginInclude() *PluginInclude {
	return &PluginInclude{}
}

// +k8s:openapi-gen=true
type PluginQueryOptions struct {
	MaxDataPoints *bool `json:"maxDataPoints,omitempty"`
	MinInterval   *bool `json:"minInterval,omitempty"`
	CacheTimeout  *bool `json:"cacheTimeout,omitempty"`
}

// NewPluginQueryOptions creates a new PluginQueryOptions object.
func NewPluginQueryOptions() *PluginQueryOptions {
	return &PluginQueryOptions{}
}

// +k8s:openapi-gen=true
type PluginRoute struct {
	Path        *string `json:"path,omitempty"`
	Method      *string `json:"method,omitempty"`
	Url         *string `json:"url,omitempty"`
	ReqSignedIn *bool   `json:"reqSignedIn,omitempty"`
	ReqRole     *string `json:"reqRole,omitempty"`
	ReqAction   *string `json:"reqAction,omitempty"`
	// +listType=atomic
	Headers      []string                         `json:"headers,omitempty"`
	Body         map[string]interface{}           `json:"body,omitempty"`
	TokenAuth    *PluginV0alpha1RouteTokenAuth    `json:"tokenAuth,omitempty"`
	JwtTokenAuth *PluginV0alpha1RouteJwtTokenAuth `json:"jwtTokenAuth,omitempty"`
	// +listType=atomic
	UrlParams []PluginV0alpha1RouteUrlParams `json:"urlParams,omitempty"`
}

// NewPluginRoute creates a new PluginRoute object.
func NewPluginRoute() *PluginRoute {
	return &PluginRoute{}
}

// +k8s:openapi-gen=true
type PluginIAM struct {
	// +listType=atomic
	Permissions []PluginV0alpha1IAMPermissions `json:"permissions,omitempty"`
}

// NewPluginIAM creates a new PluginIAM object.
func NewPluginIAM() *PluginIAM {
	return &PluginIAM{}
}

// +k8s:openapi-gen=true
type PluginRole struct {
	Role *PluginV0alpha1RoleRole `json:"role,omitempty"`
	// +listType=set
	Grants []string `json:"grants,omitempty"`
}

// NewPluginRole creates a new PluginRole object.
func NewPluginRole() *PluginRole {
	return &PluginRole{}
}

// +k8s:openapi-gen=true
type PluginExtensions struct {
	// +listType=atomic
	AddedComponents []PluginV0alpha1ExtensionsAddedComponents `json:"addedComponents,omitempty"`
	// +listType=atomic
	AddedLinks []PluginV0alpha1ExtensionsAddedLinks `json:"addedLinks,omitempty"`
	// +listType=set
	// +listMapKey=id
	ExposedComponents []PluginV0alpha1ExtensionsExposedComponents `json:"exposedComponents,omitempty"`
	// +listType=set
	// +listMapKey=id
	ExtensionPoints []PluginV0alpha1ExtensionsExtensionPoints `json:"extensionPoints,omitempty"`
}

// NewPluginExtensions creates a new PluginExtensions object.
func NewPluginExtensions() *PluginExtensions {
	return &PluginExtensions{}
}

// spec is the schema of our resource
// +k8s:openapi-gen=true
type PluginSpec struct {
	PluginJSON PluginJSONData `json:"pluginJSON"`
}

// NewPluginSpec creates a new PluginSpec object.
func NewPluginSpec() *PluginSpec {
	return &PluginSpec{
		PluginJSON: *NewPluginJSONData(),
	}
}

// +k8s:openapi-gen=true
type PluginV0alpha1InfoLogos struct {
	Small string `json:"small"`
	Large string `json:"large"`
}

// NewPluginV0alpha1InfoLogos creates a new PluginV0alpha1InfoLogos object.
func NewPluginV0alpha1InfoLogos() *PluginV0alpha1InfoLogos {
	return &PluginV0alpha1InfoLogos{}
}

// +k8s:openapi-gen=true
type PluginV0alpha1InfoAuthor struct {
	Name  *string `json:"name,omitempty"`
	Email *string `json:"email,omitempty"`
	Url   *string `json:"url,omitempty"`
}

// NewPluginV0alpha1InfoAuthor creates a new PluginV0alpha1InfoAuthor object.
func NewPluginV0alpha1InfoAuthor() *PluginV0alpha1InfoAuthor {
	return &PluginV0alpha1InfoAuthor{}
}

// +k8s:openapi-gen=true
type PluginV0alpha1InfoBuild struct {
	Time   *float64 `json:"time,omitempty"`
	Repo   *string  `json:"repo,omitempty"`
	Branch *string  `json:"branch,omitempty"`
	Hash   *string  `json:"hash,omitempty"`
	// 		number?: number // cannot have field with this name
	Pr    *float64 `json:"pr,omitempty"`
	Build *float64 `json:"build,omitempty"`
}

// NewPluginV0alpha1InfoBuild creates a new PluginV0alpha1InfoBuild object.
func NewPluginV0alpha1InfoBuild() *PluginV0alpha1InfoBuild {
	return &PluginV0alpha1InfoBuild{}
}

// +k8s:openapi-gen=true
type PluginV0alpha1InfoLinks struct {
	Name *string `json:"name,omitempty"`
	Url  *string `json:"url,omitempty"`
}

// NewPluginV0alpha1InfoLinks creates a new PluginV0alpha1InfoLinks object.
func NewPluginV0alpha1InfoLinks() *PluginV0alpha1InfoLinks {
	return &PluginV0alpha1InfoLinks{}
}

// +k8s:openapi-gen=true
type PluginV0alpha1InfoScreenshots struct {
	Name *string `json:"name,omitempty"`
	Path *string `json:"path,omitempty"`
}

// NewPluginV0alpha1InfoScreenshots creates a new PluginV0alpha1InfoScreenshots object.
func NewPluginV0alpha1InfoScreenshots() *PluginV0alpha1InfoScreenshots {
	return &PluginV0alpha1InfoScreenshots{}
}

// +k8s:openapi-gen=true
type PluginV0alpha1DependenciesPlugins struct {
	Id   string                                `json:"id"`
	Type PluginV0alpha1DependenciesPluginsType `json:"type"`
	Name string                                `json:"name"`
}

// NewPluginV0alpha1DependenciesPlugins creates a new PluginV0alpha1DependenciesPlugins object.
func NewPluginV0alpha1DependenciesPlugins() *PluginV0alpha1DependenciesPlugins {
	return &PluginV0alpha1DependenciesPlugins{}
}

// +k8s:openapi-gen=true
type PluginV0alpha1DependenciesExtensions struct {
	// +listType=set
	ExposedComponents []string `json:"exposedComponents,omitempty"`
}

// NewPluginV0alpha1DependenciesExtensions creates a new PluginV0alpha1DependenciesExtensions object.
func NewPluginV0alpha1DependenciesExtensions() *PluginV0alpha1DependenciesExtensions {
	return &PluginV0alpha1DependenciesExtensions{}
}

// +k8s:openapi-gen=true
type PluginV0alpha1RouteTokenAuth struct {
	Url *string `json:"url,omitempty"`
	// +listType=set
	Scopes []string               `json:"scopes,omitempty"`
	Params map[string]interface{} `json:"params,omitempty"`
}

// NewPluginV0alpha1RouteTokenAuth creates a new PluginV0alpha1RouteTokenAuth object.
func NewPluginV0alpha1RouteTokenAuth() *PluginV0alpha1RouteTokenAuth {
	return &PluginV0alpha1RouteTokenAuth{}
}

// +k8s:openapi-gen=true
type PluginV0alpha1RouteJwtTokenAuth struct {
	Url *string `json:"url,omitempty"`
	// +listType=set
	Scopes []string               `json:"scopes,omitempty"`
	Params map[string]interface{} `json:"params,omitempty"`
}

// NewPluginV0alpha1RouteJwtTokenAuth creates a new PluginV0alpha1RouteJwtTokenAuth object.
func NewPluginV0alpha1RouteJwtTokenAuth() *PluginV0alpha1RouteJwtTokenAuth {
	return &PluginV0alpha1RouteJwtTokenAuth{}
}

// +k8s:openapi-gen=true
type PluginV0alpha1RouteUrlParams struct {
	Name    *string `json:"name,omitempty"`
	Content *string `json:"content,omitempty"`
}

// NewPluginV0alpha1RouteUrlParams creates a new PluginV0alpha1RouteUrlParams object.
func NewPluginV0alpha1RouteUrlParams() *PluginV0alpha1RouteUrlParams {
	return &PluginV0alpha1RouteUrlParams{}
}

// +k8s:openapi-gen=true
type PluginV0alpha1IAMPermissions struct {
	Action *string `json:"action,omitempty"`
	Scope  *string `json:"scope,omitempty"`
}

// NewPluginV0alpha1IAMPermissions creates a new PluginV0alpha1IAMPermissions object.
func NewPluginV0alpha1IAMPermissions() *PluginV0alpha1IAMPermissions {
	return &PluginV0alpha1IAMPermissions{}
}

// +k8s:openapi-gen=true
type PluginV0alpha1RoleRolePermissions struct {
	Action *string `json:"action,omitempty"`
	Scope  *string `json:"scope,omitempty"`
}

// NewPluginV0alpha1RoleRolePermissions creates a new PluginV0alpha1RoleRolePermissions object.
func NewPluginV0alpha1RoleRolePermissions() *PluginV0alpha1RoleRolePermissions {
	return &PluginV0alpha1RoleRolePermissions{}
}

// +k8s:openapi-gen=true
type PluginV0alpha1RoleRole struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	// +listType=atomic
	Permissions []PluginV0alpha1RoleRolePermissions `json:"permissions,omitempty"`
}

// NewPluginV0alpha1RoleRole creates a new PluginV0alpha1RoleRole object.
func NewPluginV0alpha1RoleRole() *PluginV0alpha1RoleRole {
	return &PluginV0alpha1RoleRole{}
}

// +k8s:openapi-gen=true
type PluginV0alpha1ExtensionsAddedComponents struct {
	// +listType=set
	Targets     []string `json:"targets"`
	Title       string   `json:"title"`
	Description *string  `json:"description,omitempty"`
}

// NewPluginV0alpha1ExtensionsAddedComponents creates a new PluginV0alpha1ExtensionsAddedComponents object.
func NewPluginV0alpha1ExtensionsAddedComponents() *PluginV0alpha1ExtensionsAddedComponents {
	return &PluginV0alpha1ExtensionsAddedComponents{
		Targets: []string{},
	}
}

// +k8s:openapi-gen=true
type PluginV0alpha1ExtensionsAddedLinks struct {
	// +listType=set
	Targets     []string `json:"targets"`
	Title       string   `json:"title"`
	Description *string  `json:"description,omitempty"`
}

// NewPluginV0alpha1ExtensionsAddedLinks creates a new PluginV0alpha1ExtensionsAddedLinks object.
func NewPluginV0alpha1ExtensionsAddedLinks() *PluginV0alpha1ExtensionsAddedLinks {
	return &PluginV0alpha1ExtensionsAddedLinks{
		Targets: []string{},
	}
}

// +k8s:openapi-gen=true
type PluginV0alpha1ExtensionsExposedComponents struct {
	Id          string  `json:"id"`
	Title       *string `json:"title,omitempty"`
	Description *string `json:"description,omitempty"`
}

// NewPluginV0alpha1ExtensionsExposedComponents creates a new PluginV0alpha1ExtensionsExposedComponents object.
func NewPluginV0alpha1ExtensionsExposedComponents() *PluginV0alpha1ExtensionsExposedComponents {
	return &PluginV0alpha1ExtensionsExposedComponents{}
}

// +k8s:openapi-gen=true
type PluginV0alpha1ExtensionsExtensionPoints struct {
	Id          string  `json:"id"`
	Title       *string `json:"title,omitempty"`
	Description *string `json:"description,omitempty"`
}

// NewPluginV0alpha1ExtensionsExtensionPoints creates a new PluginV0alpha1ExtensionsExtensionPoints object.
func NewPluginV0alpha1ExtensionsExtensionPoints() *PluginV0alpha1ExtensionsExtensionPoints {
	return &PluginV0alpha1ExtensionsExtensionPoints{}
}

// +k8s:openapi-gen=true
type PluginJSONDataType string

const (
	PluginJSONDataTypeApp        PluginJSONDataType = "app"
	PluginJSONDataTypeDatasource PluginJSONDataType = "datasource"
	PluginJSONDataTypePanel      PluginJSONDataType = "panel"
	PluginJSONDataTypeRenderer   PluginJSONDataType = "renderer"
)

// +k8s:openapi-gen=true
type PluginJSONDataCategory string

const (
	PluginJSONDataCategoryTsdb       PluginJSONDataCategory = "tsdb"
	PluginJSONDataCategoryLogging    PluginJSONDataCategory = "logging"
	PluginJSONDataCategoryCloud      PluginJSONDataCategory = "cloud"
	PluginJSONDataCategoryTracing    PluginJSONDataCategory = "tracing"
	PluginJSONDataCategoryProfiling  PluginJSONDataCategory = "profiling"
	PluginJSONDataCategorySql        PluginJSONDataCategory = "sql"
	PluginJSONDataCategoryEnterprise PluginJSONDataCategory = "enterprise"
	PluginJSONDataCategoryIot        PluginJSONDataCategory = "iot"
	PluginJSONDataCategoryOther      PluginJSONDataCategory = "other"
)

// +k8s:openapi-gen=true
type PluginJSONDataState string

const (
	PluginJSONDataStateAlpha PluginJSONDataState = "alpha"
	PluginJSONDataStateBeta  PluginJSONDataState = "beta"
)

// +k8s:openapi-gen=true
type PluginIncludeType string

const (
	PluginIncludeTypeDashboard  PluginIncludeType = "dashboard"
	PluginIncludeTypePage       PluginIncludeType = "page"
	PluginIncludeTypePanel      PluginIncludeType = "panel"
	PluginIncludeTypeDatasource PluginIncludeType = "datasource"
)

// +k8s:openapi-gen=true
type PluginIncludeRole string

const (
	PluginIncludeRoleAdmin  PluginIncludeRole = "Admin"
	PluginIncludeRoleEditor PluginIncludeRole = "Editor"
	PluginIncludeRoleViewer PluginIncludeRole = "Viewer"
)

// +k8s:openapi-gen=true
type PluginV0alpha1DependenciesPluginsType string

const (
	PluginV0alpha1DependenciesPluginsTypeApp        PluginV0alpha1DependenciesPluginsType = "app"
	PluginV0alpha1DependenciesPluginsTypeDatasource PluginV0alpha1DependenciesPluginsType = "datasource"
	PluginV0alpha1DependenciesPluginsTypePanel      PluginV0alpha1DependenciesPluginsType = "panel"
)
