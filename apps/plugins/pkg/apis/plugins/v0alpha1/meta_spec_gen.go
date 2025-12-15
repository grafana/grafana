// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// JSON configuration schema for Grafana plugins
// Converted from: https://github.com/grafana/grafana/blob/main/docs/sources/developers/plugins/plugin.schema.json
// +k8s:openapi-gen=true
type MetaJSONData struct {
	// Unique name of the plugin
	Id string `json:"id"`
	// Plugin type
	Type MetaJSONDataType `json:"type"`
	// Human-readable name of the plugin
	Name string `json:"name"`
	// Metadata for the plugin
	Info MetaInfo `json:"info"`
	// Dependency information
	Dependencies MetaDependencies `json:"dependencies"`
	// Optional fields
	Alerting           *bool                   `json:"alerting,omitempty"`
	Annotations        *bool                   `json:"annotations,omitempty"`
	AutoEnabled        *bool                   `json:"autoEnabled,omitempty"`
	Backend            *bool                   `json:"backend,omitempty"`
	BuildMode          *string                 `json:"buildMode,omitempty"`
	BuiltIn            *bool                   `json:"builtIn,omitempty"`
	Category           *MetaJSONDataCategory   `json:"category,omitempty"`
	EnterpriseFeatures *MetaEnterpriseFeatures `json:"enterpriseFeatures,omitempty"`
	Executable         *string                 `json:"executable,omitempty"`
	HideFromList       *bool                   `json:"hideFromList,omitempty"`
	// +listType=atomic
	Includes                  []MetaInclude     `json:"includes,omitempty"`
	Logs                      *bool             `json:"logs,omitempty"`
	Metrics                   *bool             `json:"metrics,omitempty"`
	MultiValueFilterOperators *bool             `json:"multiValueFilterOperators,omitempty"`
	PascalName                *string           `json:"pascalName,omitempty"`
	Preload                   *bool             `json:"preload,omitempty"`
	QueryOptions              *MetaQueryOptions `json:"queryOptions,omitempty"`
	// +listType=atomic
	Routes        []MetaRoute        `json:"routes,omitempty"`
	SkipDataQuery *bool              `json:"skipDataQuery,omitempty"`
	State         *MetaJSONDataState `json:"state,omitempty"`
	Streaming     *bool              `json:"streaming,omitempty"`
	Suggestions   *bool              `json:"suggestions,omitempty"`
	Tracing       *bool              `json:"tracing,omitempty"`
	Iam           *MetaIAM           `json:"iam,omitempty"`
	// +listType=atomic
	Roles      []MetaRole      `json:"roles,omitempty"`
	Extensions *MetaExtensions `json:"extensions,omitempty"`
}

// NewMetaJSONData creates a new MetaJSONData object.
func NewMetaJSONData() *MetaJSONData {
	return &MetaJSONData{
		Info:         *NewMetaInfo(),
		Dependencies: *NewMetaDependencies(),
	}
}

// +k8s:openapi-gen=true
type MetaInfo struct {
	// Required fields
	// +listType=set
	Keywords []string              `json:"keywords"`
	Logos    MetaV0alpha1InfoLogos `json:"logos"`
	Updated  string                `json:"updated"`
	Version  string                `json:"version"`
	// Optional fields
	Author      *MetaV0alpha1InfoAuthor `json:"author,omitempty"`
	Description *string                 `json:"description,omitempty"`
	// +listType=atomic
	Links []MetaV0alpha1InfoLinks `json:"links,omitempty"`
	// +listType=atomic
	Screenshots []MetaV0alpha1InfoScreenshots `json:"screenshots,omitempty"`
}

// NewMetaInfo creates a new MetaInfo object.
func NewMetaInfo() *MetaInfo {
	return &MetaInfo{
		Keywords: []string{},
		Logos:    *NewMetaV0alpha1InfoLogos(),
	}
}

// +k8s:openapi-gen=true
type MetaDependencies struct {
	// Required field
	GrafanaDependency string `json:"grafanaDependency"`
	// Optional fields
	GrafanaVersion *string `json:"grafanaVersion,omitempty"`
	// +listType=set
	// +listMapKey=id
	Plugins    []MetaV0alpha1DependenciesPlugins   `json:"plugins,omitempty"`
	Extensions *MetaV0alpha1DependenciesExtensions `json:"extensions,omitempty"`
}

// NewMetaDependencies creates a new MetaDependencies object.
func NewMetaDependencies() *MetaDependencies {
	return &MetaDependencies{}
}

// +k8s:openapi-gen=true
type MetaEnterpriseFeatures struct {
	// Allow additional properties
	HealthDiagnosticsErrors *bool `json:"healthDiagnosticsErrors,omitempty"`
}

// NewMetaEnterpriseFeatures creates a new MetaEnterpriseFeatures object.
func NewMetaEnterpriseFeatures() *MetaEnterpriseFeatures {
	return &MetaEnterpriseFeatures{
		HealthDiagnosticsErrors: (func(input bool) *bool { return &input })(false),
	}
}

// +k8s:openapi-gen=true
type MetaInclude struct {
	Uid        *string          `json:"uid,omitempty"`
	Type       *MetaIncludeType `json:"type,omitempty"`
	Name       *string          `json:"name,omitempty"`
	Component  *string          `json:"component,omitempty"`
	Role       *MetaIncludeRole `json:"role,omitempty"`
	Action     *string          `json:"action,omitempty"`
	Path       *string          `json:"path,omitempty"`
	AddToNav   *bool            `json:"addToNav,omitempty"`
	DefaultNav *bool            `json:"defaultNav,omitempty"`
	Icon       *string          `json:"icon,omitempty"`
}

// NewMetaInclude creates a new MetaInclude object.
func NewMetaInclude() *MetaInclude {
	return &MetaInclude{}
}

// +k8s:openapi-gen=true
type MetaQueryOptions struct {
	MaxDataPoints *bool `json:"maxDataPoints,omitempty"`
	MinInterval   *bool `json:"minInterval,omitempty"`
	CacheTimeout  *bool `json:"cacheTimeout,omitempty"`
}

// NewMetaQueryOptions creates a new MetaQueryOptions object.
func NewMetaQueryOptions() *MetaQueryOptions {
	return &MetaQueryOptions{}
}

// +k8s:openapi-gen=true
type MetaRoute struct {
	Path        *string `json:"path,omitempty"`
	Method      *string `json:"method,omitempty"`
	Url         *string `json:"url,omitempty"`
	ReqSignedIn *bool   `json:"reqSignedIn,omitempty"`
	ReqRole     *string `json:"reqRole,omitempty"`
	ReqAction   *string `json:"reqAction,omitempty"`
	// +listType=atomic
	Headers      []string                       `json:"headers,omitempty"`
	Body         map[string]interface{}         `json:"body,omitempty"`
	TokenAuth    *MetaV0alpha1RouteTokenAuth    `json:"tokenAuth,omitempty"`
	JwtTokenAuth *MetaV0alpha1RouteJwtTokenAuth `json:"jwtTokenAuth,omitempty"`
	// +listType=atomic
	UrlParams []MetaV0alpha1RouteUrlParams `json:"urlParams,omitempty"`
}

// NewMetaRoute creates a new MetaRoute object.
func NewMetaRoute() *MetaRoute {
	return &MetaRoute{}
}

// +k8s:openapi-gen=true
type MetaIAM struct {
	// +listType=atomic
	Permissions []MetaV0alpha1IAMPermissions `json:"permissions,omitempty"`
}

// NewMetaIAM creates a new MetaIAM object.
func NewMetaIAM() *MetaIAM {
	return &MetaIAM{}
}

// +k8s:openapi-gen=true
type MetaRole struct {
	Role *MetaV0alpha1RoleRole `json:"role,omitempty"`
	// +listType=set
	Grants []string `json:"grants,omitempty"`
}

// NewMetaRole creates a new MetaRole object.
func NewMetaRole() *MetaRole {
	return &MetaRole{}
}

// +k8s:openapi-gen=true
type MetaExtensions struct {
	// +listType=atomic
	AddedComponents []MetaV0alpha1ExtensionsAddedComponents `json:"addedComponents,omitempty"`
	// +listType=atomic
	AddedLinks []MetaV0alpha1ExtensionsAddedLinks `json:"addedLinks,omitempty"`
	// +listType=set
	// +listMapKey=id
	ExposedComponents []MetaV0alpha1ExtensionsExposedComponents `json:"exposedComponents,omitempty"`
	// +listType=set
	// +listMapKey=id
	ExtensionPoints []MetaV0alpha1ExtensionsExtensionPoints `json:"extensionPoints,omitempty"`
}

// NewMetaExtensions creates a new MetaExtensions object.
func NewMetaExtensions() *MetaExtensions {
	return &MetaExtensions{}
}

// +k8s:openapi-gen=true
type MetaSpec struct {
	PluginJSON MetaJSONData `json:"pluginJSON"`
}

// NewMetaSpec creates a new MetaSpec object.
func NewMetaSpec() *MetaSpec {
	return &MetaSpec{
		PluginJSON: *NewMetaJSONData(),
	}
}

// +k8s:openapi-gen=true
type MetaV0alpha1InfoLogos struct {
	Small string `json:"small"`
	Large string `json:"large"`
}

// NewMetaV0alpha1InfoLogos creates a new MetaV0alpha1InfoLogos object.
func NewMetaV0alpha1InfoLogos() *MetaV0alpha1InfoLogos {
	return &MetaV0alpha1InfoLogos{}
}

// +k8s:openapi-gen=true
type MetaV0alpha1InfoAuthor struct {
	Name  *string `json:"name,omitempty"`
	Email *string `json:"email,omitempty"`
	Url   *string `json:"url,omitempty"`
}

// NewMetaV0alpha1InfoAuthor creates a new MetaV0alpha1InfoAuthor object.
func NewMetaV0alpha1InfoAuthor() *MetaV0alpha1InfoAuthor {
	return &MetaV0alpha1InfoAuthor{}
}

// +k8s:openapi-gen=true
type MetaV0alpha1InfoLinks struct {
	Name *string `json:"name,omitempty"`
	Url  *string `json:"url,omitempty"`
}

// NewMetaV0alpha1InfoLinks creates a new MetaV0alpha1InfoLinks object.
func NewMetaV0alpha1InfoLinks() *MetaV0alpha1InfoLinks {
	return &MetaV0alpha1InfoLinks{}
}

// +k8s:openapi-gen=true
type MetaV0alpha1InfoScreenshots struct {
	Name *string `json:"name,omitempty"`
	Path *string `json:"path,omitempty"`
}

// NewMetaV0alpha1InfoScreenshots creates a new MetaV0alpha1InfoScreenshots object.
func NewMetaV0alpha1InfoScreenshots() *MetaV0alpha1InfoScreenshots {
	return &MetaV0alpha1InfoScreenshots{}
}

// +k8s:openapi-gen=true
type MetaV0alpha1DependenciesPlugins struct {
	Id   string                              `json:"id"`
	Type MetaV0alpha1DependenciesPluginsType `json:"type"`
	Name string                              `json:"name"`
}

// NewMetaV0alpha1DependenciesPlugins creates a new MetaV0alpha1DependenciesPlugins object.
func NewMetaV0alpha1DependenciesPlugins() *MetaV0alpha1DependenciesPlugins {
	return &MetaV0alpha1DependenciesPlugins{}
}

// +k8s:openapi-gen=true
type MetaV0alpha1DependenciesExtensions struct {
	// +listType=set
	ExposedComponents []string `json:"exposedComponents,omitempty"`
}

// NewMetaV0alpha1DependenciesExtensions creates a new MetaV0alpha1DependenciesExtensions object.
func NewMetaV0alpha1DependenciesExtensions() *MetaV0alpha1DependenciesExtensions {
	return &MetaV0alpha1DependenciesExtensions{}
}

// +k8s:openapi-gen=true
type MetaV0alpha1RouteTokenAuth struct {
	Url *string `json:"url,omitempty"`
	// +listType=set
	Scopes []string               `json:"scopes,omitempty"`
	Params map[string]interface{} `json:"params,omitempty"`
}

// NewMetaV0alpha1RouteTokenAuth creates a new MetaV0alpha1RouteTokenAuth object.
func NewMetaV0alpha1RouteTokenAuth() *MetaV0alpha1RouteTokenAuth {
	return &MetaV0alpha1RouteTokenAuth{}
}

// +k8s:openapi-gen=true
type MetaV0alpha1RouteJwtTokenAuth struct {
	Url *string `json:"url,omitempty"`
	// +listType=set
	Scopes []string               `json:"scopes,omitempty"`
	Params map[string]interface{} `json:"params,omitempty"`
}

// NewMetaV0alpha1RouteJwtTokenAuth creates a new MetaV0alpha1RouteJwtTokenAuth object.
func NewMetaV0alpha1RouteJwtTokenAuth() *MetaV0alpha1RouteJwtTokenAuth {
	return &MetaV0alpha1RouteJwtTokenAuth{}
}

// +k8s:openapi-gen=true
type MetaV0alpha1RouteUrlParams struct {
	Name    *string `json:"name,omitempty"`
	Content *string `json:"content,omitempty"`
}

// NewMetaV0alpha1RouteUrlParams creates a new MetaV0alpha1RouteUrlParams object.
func NewMetaV0alpha1RouteUrlParams() *MetaV0alpha1RouteUrlParams {
	return &MetaV0alpha1RouteUrlParams{}
}

// +k8s:openapi-gen=true
type MetaV0alpha1IAMPermissions struct {
	Action *string `json:"action,omitempty"`
	Scope  *string `json:"scope,omitempty"`
}

// NewMetaV0alpha1IAMPermissions creates a new MetaV0alpha1IAMPermissions object.
func NewMetaV0alpha1IAMPermissions() *MetaV0alpha1IAMPermissions {
	return &MetaV0alpha1IAMPermissions{}
}

// +k8s:openapi-gen=true
type MetaV0alpha1RoleRolePermissions struct {
	Action *string `json:"action,omitempty"`
	Scope  *string `json:"scope,omitempty"`
}

// NewMetaV0alpha1RoleRolePermissions creates a new MetaV0alpha1RoleRolePermissions object.
func NewMetaV0alpha1RoleRolePermissions() *MetaV0alpha1RoleRolePermissions {
	return &MetaV0alpha1RoleRolePermissions{}
}

// +k8s:openapi-gen=true
type MetaV0alpha1RoleRole struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	// +listType=atomic
	Permissions []MetaV0alpha1RoleRolePermissions `json:"permissions,omitempty"`
}

// NewMetaV0alpha1RoleRole creates a new MetaV0alpha1RoleRole object.
func NewMetaV0alpha1RoleRole() *MetaV0alpha1RoleRole {
	return &MetaV0alpha1RoleRole{}
}

// +k8s:openapi-gen=true
type MetaV0alpha1ExtensionsAddedComponents struct {
	// +listType=set
	Targets     []string `json:"targets"`
	Title       string   `json:"title"`
	Description *string  `json:"description,omitempty"`
}

// NewMetaV0alpha1ExtensionsAddedComponents creates a new MetaV0alpha1ExtensionsAddedComponents object.
func NewMetaV0alpha1ExtensionsAddedComponents() *MetaV0alpha1ExtensionsAddedComponents {
	return &MetaV0alpha1ExtensionsAddedComponents{
		Targets: []string{},
	}
}

// +k8s:openapi-gen=true
type MetaV0alpha1ExtensionsAddedLinks struct {
	// +listType=set
	Targets     []string `json:"targets"`
	Title       string   `json:"title"`
	Description *string  `json:"description,omitempty"`
}

// NewMetaV0alpha1ExtensionsAddedLinks creates a new MetaV0alpha1ExtensionsAddedLinks object.
func NewMetaV0alpha1ExtensionsAddedLinks() *MetaV0alpha1ExtensionsAddedLinks {
	return &MetaV0alpha1ExtensionsAddedLinks{
		Targets: []string{},
	}
}

// +k8s:openapi-gen=true
type MetaV0alpha1ExtensionsExposedComponents struct {
	Id          string  `json:"id"`
	Title       *string `json:"title,omitempty"`
	Description *string `json:"description,omitempty"`
}

// NewMetaV0alpha1ExtensionsExposedComponents creates a new MetaV0alpha1ExtensionsExposedComponents object.
func NewMetaV0alpha1ExtensionsExposedComponents() *MetaV0alpha1ExtensionsExposedComponents {
	return &MetaV0alpha1ExtensionsExposedComponents{}
}

// +k8s:openapi-gen=true
type MetaV0alpha1ExtensionsExtensionPoints struct {
	Id          string  `json:"id"`
	Title       *string `json:"title,omitempty"`
	Description *string `json:"description,omitempty"`
}

// NewMetaV0alpha1ExtensionsExtensionPoints creates a new MetaV0alpha1ExtensionsExtensionPoints object.
func NewMetaV0alpha1ExtensionsExtensionPoints() *MetaV0alpha1ExtensionsExtensionPoints {
	return &MetaV0alpha1ExtensionsExtensionPoints{}
}

// +k8s:openapi-gen=true
type MetaJSONDataType string

const (
	MetaJSONDataTypeApp        MetaJSONDataType = "app"
	MetaJSONDataTypeDatasource MetaJSONDataType = "datasource"
	MetaJSONDataTypePanel      MetaJSONDataType = "panel"
	MetaJSONDataTypeRenderer   MetaJSONDataType = "renderer"
)

// +k8s:openapi-gen=true
type MetaJSONDataCategory string

const (
	MetaJSONDataCategoryTsdb       MetaJSONDataCategory = "tsdb"
	MetaJSONDataCategoryLogging    MetaJSONDataCategory = "logging"
	MetaJSONDataCategoryCloud      MetaJSONDataCategory = "cloud"
	MetaJSONDataCategoryTracing    MetaJSONDataCategory = "tracing"
	MetaJSONDataCategoryProfiling  MetaJSONDataCategory = "profiling"
	MetaJSONDataCategorySql        MetaJSONDataCategory = "sql"
	MetaJSONDataCategoryEnterprise MetaJSONDataCategory = "enterprise"
	MetaJSONDataCategoryIot        MetaJSONDataCategory = "iot"
	MetaJSONDataCategoryOther      MetaJSONDataCategory = "other"
)

// +k8s:openapi-gen=true
type MetaJSONDataState string

const (
	MetaJSONDataStateAlpha MetaJSONDataState = "alpha"
	MetaJSONDataStateBeta  MetaJSONDataState = "beta"
)

// +k8s:openapi-gen=true
type MetaIncludeType string

const (
	MetaIncludeTypeDashboard  MetaIncludeType = "dashboard"
	MetaIncludeTypePage       MetaIncludeType = "page"
	MetaIncludeTypePanel      MetaIncludeType = "panel"
	MetaIncludeTypeDatasource MetaIncludeType = "datasource"
)

// +k8s:openapi-gen=true
type MetaIncludeRole string

const (
	MetaIncludeRoleAdmin  MetaIncludeRole = "Admin"
	MetaIncludeRoleEditor MetaIncludeRole = "Editor"
	MetaIncludeRoleViewer MetaIncludeRole = "Viewer"
)

// +k8s:openapi-gen=true
type MetaV0alpha1DependenciesPluginsType string

const (
	MetaV0alpha1DependenciesPluginsTypeApp        MetaV0alpha1DependenciesPluginsType = "app"
	MetaV0alpha1DependenciesPluginsTypeDatasource MetaV0alpha1DependenciesPluginsType = "datasource"
	MetaV0alpha1DependenciesPluginsTypePanel      MetaV0alpha1DependenciesPluginsType = "panel"
)
