package meta

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
)

const (
	defaultCoreTTL = 24 * time.Hour
)

// CoreProvider retrieves plugin metadata for core plugins.
type CoreProvider struct {
	mu            sync.RWMutex
	loadedPlugins map[string]pluginsv0alpha1.MetaJSONData
	initialized   bool
	ttl           time.Duration
}

// NewCoreProvider creates a new CoreProvider for core plugins.
func NewCoreProvider() *CoreProvider {
	return NewCoreProviderWithTTL(defaultCoreTTL)
}

// NewCoreProviderWithTTL creates a new CoreProvider with a custom TTL.
func NewCoreProviderWithTTL(ttl time.Duration) *CoreProvider {
	return &CoreProvider{
		loadedPlugins: make(map[string]pluginsv0alpha1.MetaJSONData),
		ttl:           ttl,
	}
}

// GetMeta retrieves plugin metadata for core plugins.
func (p *CoreProvider) GetMeta(ctx context.Context, pluginID, _ string) (*Result, error) {
	// Check cache first
	p.mu.RLock()
	if meta, found := p.loadedPlugins[pluginID]; found {
		p.mu.RUnlock()
		return &Result{
			Meta: meta,
			TTL:  p.ttl,
		}, nil
	}
	p.mu.RUnlock()

	// Initialize cache if not already done
	p.mu.Lock()
	defer p.mu.Unlock()

	// Double-check after acquiring write lock
	if meta, found := p.loadedPlugins[pluginID]; found {
		return &Result{
			Meta: meta,
			TTL:  p.ttl,
		}, nil
	}

	if !p.initialized {
		if err := p.loadPlugins(ctx); err != nil {
			logging.DefaultLogger.Warn("CoreProvider: could not load core plugins, will return ErrMetaNotFound for all lookups", "error", err)
			// Mark as initialized even on failure so we don't keep trying
			p.initialized = true
			return nil, ErrMetaNotFound
		}
		p.initialized = true
	}

	if meta, found := p.loadedPlugins[pluginID]; found {
		return &Result{
			Meta: meta,
			TTL:  p.ttl,
		}, nil
	}

	return nil, ErrMetaNotFound
}

// loadPlugins discovers and caches all core plugins.
// Returns an error if the static root path cannot be found or if plugin discovery fails.
// This error will be handled gracefully by GetMeta, which will return ErrMetaNotFound
// to allow other providers to handle the request.
func (p *CoreProvider) loadPlugins(ctx context.Context) error {
	var staticRootPath string
	if wd, err := os.Getwd(); err == nil {
		// Check if we're in the Grafana root
		publicPath := filepath.Join(wd, "public", "app", "plugins")
		if _, err = os.Stat(publicPath); err == nil {
			staticRootPath = filepath.Join(wd, "public")
		}
	}

	if staticRootPath == "" {
		return errors.New("could not find Grafana static root path")
	}

	datasourcePath := filepath.Join(staticRootPath, "app", "plugins", "datasource")
	panelPath := filepath.Join(staticRootPath, "app", "plugins", "panel")

	src := sources.NewLocalSource(plugins.ClassCore, []string{datasourcePath, panelPath})
	ps, err := src.Discover(ctx)
	if err != nil {
		return err
	}

	if len(ps) == 0 {
		logging.DefaultLogger.Warn("CoreProvider: no core plugins found during discovery")
		return nil
	}

	for _, bundle := range ps {
		meta := jsonDataToMetaJSONData(bundle.Primary.JSONData)
		p.loadedPlugins[bundle.Primary.JSONData.ID] = meta
	}

	return nil
}

// jsonDataToMetaJSONData converts a plugins.JSONData to a pluginsv0alpha1.MetaJSONData.
// nolint:gocyclo
func jsonDataToMetaJSONData(jsonData plugins.JSONData) pluginsv0alpha1.MetaJSONData {
	meta := pluginsv0alpha1.MetaJSONData{
		Id:   jsonData.ID,
		Name: jsonData.Name,
	}

	// Map plugin type
	switch jsonData.Type {
	case plugins.TypeApp:
		meta.Type = pluginsv0alpha1.MetaJSONDataTypeApp
	case plugins.TypeDataSource:
		meta.Type = pluginsv0alpha1.MetaJSONDataTypeDatasource
	case plugins.TypePanel:
		meta.Type = pluginsv0alpha1.MetaJSONDataTypePanel
	case plugins.TypeRenderer:
		meta.Type = pluginsv0alpha1.MetaJSONDataTypeRenderer
	}

	// Map Info
	meta.Info = pluginsv0alpha1.MetaInfo{
		Keywords: jsonData.Info.Keywords,
		Logos: pluginsv0alpha1.MetaV0alpha1InfoLogos{
			Small: jsonData.Info.Logos.Small,
			Large: jsonData.Info.Logos.Large,
		},
		Updated: jsonData.Info.Updated,
		Version: jsonData.Info.Version,
	}

	if jsonData.Info.Description != "" {
		meta.Info.Description = &jsonData.Info.Description
	}

	if jsonData.Info.Author.Name != "" || jsonData.Info.Author.URL != "" {
		author := &pluginsv0alpha1.MetaV0alpha1InfoAuthor{}
		if jsonData.Info.Author.Name != "" {
			author.Name = &jsonData.Info.Author.Name
		}
		if jsonData.Info.Author.URL != "" {
			author.Url = &jsonData.Info.Author.URL
		}
		meta.Info.Author = author
	}

	if len(jsonData.Info.Links) > 0 {
		meta.Info.Links = make([]pluginsv0alpha1.MetaV0alpha1InfoLinks, 0, len(jsonData.Info.Links))
		for _, link := range jsonData.Info.Links {
			v0Link := pluginsv0alpha1.MetaV0alpha1InfoLinks{}
			if link.Name != "" {
				v0Link.Name = &link.Name
			}
			if link.URL != "" {
				v0Link.Url = &link.URL
			}
			meta.Info.Links = append(meta.Info.Links, v0Link)
		}
	}

	if len(jsonData.Info.Screenshots) > 0 {
		meta.Info.Screenshots = make([]pluginsv0alpha1.MetaV0alpha1InfoScreenshots, 0, len(jsonData.Info.Screenshots))
		for _, screenshot := range jsonData.Info.Screenshots {
			v0Screenshot := pluginsv0alpha1.MetaV0alpha1InfoScreenshots{}
			if screenshot.Name != "" {
				v0Screenshot.Name = &screenshot.Name
			}
			if screenshot.Path != "" {
				v0Screenshot.Path = &screenshot.Path
			}
			meta.Info.Screenshots = append(meta.Info.Screenshots, v0Screenshot)
		}
	}

	// Map Dependencies
	meta.Dependencies = pluginsv0alpha1.MetaDependencies{
		GrafanaDependency: jsonData.Dependencies.GrafanaDependency,
	}

	if jsonData.Dependencies.GrafanaVersion != "" {
		meta.Dependencies.GrafanaVersion = &jsonData.Dependencies.GrafanaVersion
	}

	if len(jsonData.Dependencies.Plugins) > 0 {
		meta.Dependencies.Plugins = make([]pluginsv0alpha1.MetaV0alpha1DependenciesPlugins, 0, len(jsonData.Dependencies.Plugins))
		for _, dep := range jsonData.Dependencies.Plugins {
			var depType pluginsv0alpha1.MetaV0alpha1DependenciesPluginsType
			switch dep.Type {
			case "app":
				depType = pluginsv0alpha1.MetaV0alpha1DependenciesPluginsTypeApp
			case "datasource":
				depType = pluginsv0alpha1.MetaV0alpha1DependenciesPluginsTypeDatasource
			case "panel":
				depType = pluginsv0alpha1.MetaV0alpha1DependenciesPluginsTypePanel
			}
			meta.Dependencies.Plugins = append(meta.Dependencies.Plugins, pluginsv0alpha1.MetaV0alpha1DependenciesPlugins{
				Id:   dep.ID,
				Type: depType,
				Name: dep.Name,
			})
		}
	}

	if len(jsonData.Dependencies.Extensions.ExposedComponents) > 0 {
		meta.Dependencies.Extensions = &pluginsv0alpha1.MetaV0alpha1DependenciesExtensions{
			ExposedComponents: jsonData.Dependencies.Extensions.ExposedComponents,
		}
	}

	// Map optional boolean fields
	if jsonData.Alerting {
		meta.Alerting = &jsonData.Alerting
	}
	if jsonData.Annotations {
		meta.Annotations = &jsonData.Annotations
	}
	if jsonData.AutoEnabled {
		meta.AutoEnabled = &jsonData.AutoEnabled
	}
	if jsonData.Backend {
		meta.Backend = &jsonData.Backend
	}
	if jsonData.BuiltIn {
		meta.BuiltIn = &jsonData.BuiltIn
	}
	if jsonData.HideFromList {
		meta.HideFromList = &jsonData.HideFromList
	}
	if jsonData.Logs {
		meta.Logs = &jsonData.Logs
	}
	if jsonData.Metrics {
		meta.Metrics = &jsonData.Metrics
	}
	if jsonData.MultiValueFilterOperators {
		meta.MultiValueFilterOperators = &jsonData.MultiValueFilterOperators
	}
	if jsonData.Preload {
		meta.Preload = &jsonData.Preload
	}
	if jsonData.SkipDataQuery {
		meta.SkipDataQuery = &jsonData.SkipDataQuery
	}
	if jsonData.Streaming {
		meta.Streaming = &jsonData.Streaming
	}
	if jsonData.Tracing {
		meta.Tracing = &jsonData.Tracing
	}

	// Map category
	if jsonData.Category != "" {
		var category pluginsv0alpha1.MetaJSONDataCategory
		switch jsonData.Category {
		case "tsdb":
			category = pluginsv0alpha1.MetaJSONDataCategoryTsdb
		case "logging":
			category = pluginsv0alpha1.MetaJSONDataCategoryLogging
		case "cloud":
			category = pluginsv0alpha1.MetaJSONDataCategoryCloud
		case "tracing":
			category = pluginsv0alpha1.MetaJSONDataCategoryTracing
		case "profiling":
			category = pluginsv0alpha1.MetaJSONDataCategoryProfiling
		case "sql":
			category = pluginsv0alpha1.MetaJSONDataCategorySql
		case "enterprise":
			category = pluginsv0alpha1.MetaJSONDataCategoryEnterprise
		case "iot":
			category = pluginsv0alpha1.MetaJSONDataCategoryIot
		case "other":
			category = pluginsv0alpha1.MetaJSONDataCategoryOther
		default:
			category = pluginsv0alpha1.MetaJSONDataCategoryOther
		}
		meta.Category = &category
	}

	// Map state
	if jsonData.State != "" {
		var state pluginsv0alpha1.MetaJSONDataState
		switch jsonData.State {
		case plugins.ReleaseStateAlpha:
			state = pluginsv0alpha1.MetaJSONDataStateAlpha
		case plugins.ReleaseStateBeta:
			state = pluginsv0alpha1.MetaJSONDataStateBeta
		default:
		}
		if state != "" {
			meta.State = &state
		}
	}

	// Map executable
	if jsonData.Executable != "" {
		meta.Executable = &jsonData.Executable
	}

	// Map QueryOptions
	if len(jsonData.QueryOptions) > 0 {
		queryOptions := &pluginsv0alpha1.MetaQueryOptions{}
		if val, ok := jsonData.QueryOptions["maxDataPoints"]; ok {
			queryOptions.MaxDataPoints = &val
		}
		if val, ok := jsonData.QueryOptions["minInterval"]; ok {
			queryOptions.MinInterval = &val
		}
		if val, ok := jsonData.QueryOptions["cacheTimeout"]; ok {
			queryOptions.CacheTimeout = &val
		}
		meta.QueryOptions = queryOptions
	}

	// Map Includes
	if len(jsonData.Includes) > 0 {
		meta.Includes = make([]pluginsv0alpha1.MetaInclude, 0, len(jsonData.Includes))
		for _, include := range jsonData.Includes {
			v0Include := pluginsv0alpha1.MetaInclude{}
			if include.UID != "" {
				v0Include.Uid = &include.UID
			}
			if include.Type != "" {
				var includeType pluginsv0alpha1.MetaIncludeType
				switch include.Type {
				case "dashboard":
					includeType = pluginsv0alpha1.MetaIncludeTypeDashboard
				case "page":
					includeType = pluginsv0alpha1.MetaIncludeTypePage
				case "panel":
					includeType = pluginsv0alpha1.MetaIncludeTypePanel
				case "datasource":
					includeType = pluginsv0alpha1.MetaIncludeTypeDatasource
				}
				v0Include.Type = &includeType
			}
			if include.Name != "" {
				v0Include.Name = &include.Name
			}
			if include.Component != "" {
				v0Include.Component = &include.Component
			}
			if include.Role != "" {
				var role pluginsv0alpha1.MetaIncludeRole
				switch include.Role {
				case "Admin":
					role = pluginsv0alpha1.MetaIncludeRoleAdmin
				case "Editor":
					role = pluginsv0alpha1.MetaIncludeRoleEditor
				case "Viewer":
					role = pluginsv0alpha1.MetaIncludeRoleViewer
				}
				v0Include.Role = &role
			}
			if include.Action != "" {
				v0Include.Action = &include.Action
			}
			if include.Path != "" {
				v0Include.Path = &include.Path
			}
			if include.AddToNav {
				v0Include.AddToNav = &include.AddToNav
			}
			if include.DefaultNav {
				v0Include.DefaultNav = &include.DefaultNav
			}
			if include.Icon != "" {
				v0Include.Icon = &include.Icon
			}
			meta.Includes = append(meta.Includes, v0Include)
		}
	}

	// Map Routes
	if len(jsonData.Routes) > 0 {
		meta.Routes = make([]pluginsv0alpha1.MetaRoute, 0, len(jsonData.Routes))
		for _, route := range jsonData.Routes {
			v0Route := pluginsv0alpha1.MetaRoute{}
			if route.Path != "" {
				v0Route.Path = &route.Path
			}
			if route.Method != "" {
				v0Route.Method = &route.Method
			}
			if route.URL != "" {
				v0Route.Url = &route.URL
			}
			if route.ReqRole != "" {
				reqRole := string(route.ReqRole)
				v0Route.ReqRole = &reqRole
			}
			if route.ReqAction != "" {
				v0Route.ReqAction = &route.ReqAction
			}
			if len(route.Headers) > 0 {
				headers := make([]string, 0, len(route.Headers))
				for _, header := range route.Headers {
					headers = append(headers, header.Name+": "+header.Content)
				}
				v0Route.Headers = headers
			}
			if len(route.URLParams) > 0 {
				v0Route.UrlParams = make([]pluginsv0alpha1.MetaV0alpha1RouteUrlParams, 0, len(route.URLParams))
				for _, param := range route.URLParams {
					v0Param := pluginsv0alpha1.MetaV0alpha1RouteUrlParams{}
					if param.Name != "" {
						v0Param.Name = &param.Name
					}
					if param.Content != "" {
						v0Param.Content = &param.Content
					}
					v0Route.UrlParams = append(v0Route.UrlParams, v0Param)
				}
			}
			if route.TokenAuth != nil {
				v0Route.TokenAuth = &pluginsv0alpha1.MetaV0alpha1RouteTokenAuth{}
				if route.TokenAuth.Url != "" {
					v0Route.TokenAuth.Url = &route.TokenAuth.Url
				}
				if len(route.TokenAuth.Scopes) > 0 {
					v0Route.TokenAuth.Scopes = route.TokenAuth.Scopes
				}
				if len(route.TokenAuth.Params) > 0 {
					v0Route.TokenAuth.Params = make(map[string]interface{})
					for k, v := range route.TokenAuth.Params {
						v0Route.TokenAuth.Params[k] = v
					}
				}
			}
			if route.JwtTokenAuth != nil {
				v0Route.JwtTokenAuth = &pluginsv0alpha1.MetaV0alpha1RouteJwtTokenAuth{}
				if route.JwtTokenAuth.Url != "" {
					v0Route.JwtTokenAuth.Url = &route.JwtTokenAuth.Url
				}
				if len(route.JwtTokenAuth.Scopes) > 0 {
					v0Route.JwtTokenAuth.Scopes = route.JwtTokenAuth.Scopes
				}
				if len(route.JwtTokenAuth.Params) > 0 {
					v0Route.JwtTokenAuth.Params = make(map[string]interface{})
					for k, v := range route.JwtTokenAuth.Params {
						v0Route.JwtTokenAuth.Params[k] = v
					}
				}
			}
			if len(route.Body) > 0 {
				var bodyMap map[string]interface{}
				if err := json.Unmarshal(route.Body, &bodyMap); err == nil {
					v0Route.Body = bodyMap
				}
			}
			meta.Routes = append(meta.Routes, v0Route)
		}
	}

	// Map Extensions
	if len(jsonData.Extensions.AddedLinks) > 0 || len(jsonData.Extensions.AddedComponents) > 0 ||
		len(jsonData.Extensions.ExposedComponents) > 0 || len(jsonData.Extensions.ExtensionPoints) > 0 {
		extensions := &pluginsv0alpha1.MetaExtensions{}

		if len(jsonData.Extensions.AddedLinks) > 0 {
			extensions.AddedLinks = make([]pluginsv0alpha1.MetaV0alpha1ExtensionsAddedLinks, 0, len(jsonData.Extensions.AddedLinks))
			for _, link := range jsonData.Extensions.AddedLinks {
				v0Link := pluginsv0alpha1.MetaV0alpha1ExtensionsAddedLinks{
					Targets: link.Targets,
					Title:   link.Title,
				}
				if link.Description != "" {
					v0Link.Description = &link.Description
				}
				extensions.AddedLinks = append(extensions.AddedLinks, v0Link)
			}
		}

		if len(jsonData.Extensions.AddedComponents) > 0 {
			extensions.AddedComponents = make([]pluginsv0alpha1.MetaV0alpha1ExtensionsAddedComponents, 0, len(jsonData.Extensions.AddedComponents))
			for _, comp := range jsonData.Extensions.AddedComponents {
				v0Comp := pluginsv0alpha1.MetaV0alpha1ExtensionsAddedComponents{
					Targets: comp.Targets,
					Title:   comp.Title,
				}
				if comp.Description != "" {
					v0Comp.Description = &comp.Description
				}
				extensions.AddedComponents = append(extensions.AddedComponents, v0Comp)
			}
		}

		if len(jsonData.Extensions.ExposedComponents) > 0 {
			extensions.ExposedComponents = make([]pluginsv0alpha1.MetaV0alpha1ExtensionsExposedComponents, 0, len(jsonData.Extensions.ExposedComponents))
			for _, comp := range jsonData.Extensions.ExposedComponents {
				v0Comp := pluginsv0alpha1.MetaV0alpha1ExtensionsExposedComponents{
					Id: comp.Id,
				}
				if comp.Title != "" {
					v0Comp.Title = &comp.Title
				}
				if comp.Description != "" {
					v0Comp.Description = &comp.Description
				}
				extensions.ExposedComponents = append(extensions.ExposedComponents, v0Comp)
			}
		}

		if len(jsonData.Extensions.ExtensionPoints) > 0 {
			extensions.ExtensionPoints = make([]pluginsv0alpha1.MetaV0alpha1ExtensionsExtensionPoints, 0, len(jsonData.Extensions.ExtensionPoints))
			for _, point := range jsonData.Extensions.ExtensionPoints {
				v0Point := pluginsv0alpha1.MetaV0alpha1ExtensionsExtensionPoints{
					Id: point.Id,
				}
				if point.Title != "" {
					v0Point.Title = &point.Title
				}
				if point.Description != "" {
					v0Point.Description = &point.Description
				}
				extensions.ExtensionPoints = append(extensions.ExtensionPoints, v0Point)
			}
		}

		meta.Extensions = extensions
	}

	// Map Roles
	if len(jsonData.Roles) > 0 {
		meta.Roles = make([]pluginsv0alpha1.MetaRole, 0, len(jsonData.Roles))
		for _, role := range jsonData.Roles {
			v0Role := pluginsv0alpha1.MetaRole{
				Grants: role.Grants,
			}
			if role.Role.Name != "" || role.Role.Description != "" || len(role.Role.Permissions) > 0 {
				v0RoleRole := &pluginsv0alpha1.MetaV0alpha1RoleRole{}
				if role.Role.Name != "" {
					v0RoleRole.Name = &role.Role.Name
				}
				if role.Role.Description != "" {
					v0RoleRole.Description = &role.Role.Description
				}
				if len(role.Role.Permissions) > 0 {
					v0RoleRole.Permissions = make([]pluginsv0alpha1.MetaV0alpha1RoleRolePermissions, 0, len(role.Role.Permissions))
					for _, perm := range role.Role.Permissions {
						v0Perm := pluginsv0alpha1.MetaV0alpha1RoleRolePermissions{}
						if perm.Action != "" {
							v0Perm.Action = &perm.Action
						}
						if perm.Scope != "" {
							v0Perm.Scope = &perm.Scope
						}
						v0RoleRole.Permissions = append(v0RoleRole.Permissions, v0Perm)
					}
				}
				v0Role.Role = v0RoleRole
			}
			meta.Roles = append(meta.Roles, v0Role)
		}
	}

	// Map IAM
	if jsonData.IAM != nil && len(jsonData.IAM.Permissions) > 0 {
		iam := &pluginsv0alpha1.MetaIAM{
			Permissions: make([]pluginsv0alpha1.MetaV0alpha1IAMPermissions, 0, len(jsonData.IAM.Permissions)),
		}
		for _, perm := range jsonData.IAM.Permissions {
			v0Perm := pluginsv0alpha1.MetaV0alpha1IAMPermissions{}
			if perm.Action != "" {
				v0Perm.Action = &perm.Action
			}
			if perm.Scope != "" {
				v0Perm.Scope = &perm.Scope
			}
			iam.Permissions = append(iam.Permissions, v0Perm)
		}
		meta.Iam = iam
	}

	return meta
}
