package meta

import (
	"encoding/json"
	"time"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/auth"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

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
				case identity.RoleAdmin:
					role = pluginsv0alpha1.MetaIncludeRoleAdmin
				case identity.RoleEditor:
					role = pluginsv0alpha1.MetaIncludeRoleEditor
				case identity.RoleViewer:
					role = pluginsv0alpha1.MetaIncludeRoleViewer
				case identity.RoleNone:
					role = pluginsv0alpha1.MetaIncludeRoleNone
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
				headers := make([]pluginsv0alpha1.MetaV0alpha1RouteHeaders, 0, len(route.Headers))
				for _, header := range route.Headers {
					headers = append(headers, pluginsv0alpha1.MetaV0alpha1RouteHeaders{
						Name:    header.Name,
						Content: header.Content,
					})
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
		len(jsonData.Extensions.ExposedComponents) > 0 || len(jsonData.Extensions.ExtensionPoints) > 0 ||
		len(jsonData.Extensions.AddedFunctions) > 0 {
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

		if len(jsonData.Extensions.AddedFunctions) > 0 {
			extensions.AddedFunctions = make([]pluginsv0alpha1.MetaV0alpha1ExtensionsAddedFunctions, 0, len(jsonData.Extensions.AddedFunctions))
			for _, comp := range jsonData.Extensions.AddedFunctions {
				v0Comp := pluginsv0alpha1.MetaV0alpha1ExtensionsAddedFunctions{
					Targets: comp.Targets,
					Title:   comp.Title,
				}
				if comp.Description != "" {
					v0Comp.Description = &comp.Description
				}
				extensions.AddedFunctions = append(extensions.AddedFunctions, v0Comp)
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

// metaJSONDataToJSONData converts a pluginsv0alpha1.MetaJSONData to a plugins.JSONData.
// This is the reverse of jsonDataToMetaJSONData.
// nolint:gocyclo
func metaJSONDataToJSONData(meta pluginsv0alpha1.MetaJSONData) plugins.JSONData {
	jsonData := plugins.JSONData{
		ID:   meta.Id,
		Name: meta.Name,
	}

	// Map plugin type
	switch meta.Type {
	case pluginsv0alpha1.MetaJSONDataTypeApp:
		jsonData.Type = plugins.TypeApp
	case pluginsv0alpha1.MetaJSONDataTypeDatasource:
		jsonData.Type = plugins.TypeDataSource
	case pluginsv0alpha1.MetaJSONDataTypePanel:
		jsonData.Type = plugins.TypePanel
	case pluginsv0alpha1.MetaJSONDataTypeRenderer:
		jsonData.Type = plugins.TypeRenderer
	}

	// Map Info
	jsonData.Info = plugins.Info{
		Keywords: meta.Info.Keywords,
		Logos: plugins.Logos{
			Small: meta.Info.Logos.Small,
			Large: meta.Info.Logos.Large,
		},
		Updated: meta.Info.Updated,
		Version: meta.Info.Version,
	}

	if meta.Info.Description != nil {
		jsonData.Info.Description = *meta.Info.Description
	}

	if meta.Info.Author != nil {
		jsonData.Info.Author = plugins.InfoLink{}
		if meta.Info.Author.Name != nil {
			jsonData.Info.Author.Name = *meta.Info.Author.Name
		}
		if meta.Info.Author.Url != nil {
			jsonData.Info.Author.URL = *meta.Info.Author.Url
		}
	}

	if len(meta.Info.Links) > 0 {
		jsonData.Info.Links = make([]plugins.InfoLink, 0, len(meta.Info.Links))
		for _, link := range meta.Info.Links {
			infoLink := plugins.InfoLink{}
			if link.Name != nil {
				infoLink.Name = *link.Name
			}
			if link.Url != nil {
				infoLink.URL = *link.Url
			}
			jsonData.Info.Links = append(jsonData.Info.Links, infoLink)
		}
	}

	if len(meta.Info.Screenshots) > 0 {
		jsonData.Info.Screenshots = make([]plugins.Screenshots, 0, len(meta.Info.Screenshots))
		for _, screenshot := range meta.Info.Screenshots {
			sc := plugins.Screenshots{}
			if screenshot.Name != nil {
				sc.Name = *screenshot.Name
			}
			if screenshot.Path != nil {
				sc.Path = *screenshot.Path
			}
			jsonData.Info.Screenshots = append(jsonData.Info.Screenshots, sc)
		}
	}

	// Map Dependencies
	jsonData.Dependencies = plugins.Dependencies{
		GrafanaDependency: meta.Dependencies.GrafanaDependency,
	}
	if meta.Dependencies.GrafanaVersion != nil {
		jsonData.Dependencies.GrafanaVersion = *meta.Dependencies.GrafanaVersion
	}

	if len(meta.Dependencies.Plugins) > 0 {
		jsonData.Dependencies.Plugins = make([]plugins.Dependency, 0, len(meta.Dependencies.Plugins))
		for _, dep := range meta.Dependencies.Plugins {
			var depType string
			switch dep.Type {
			case pluginsv0alpha1.MetaV0alpha1DependenciesPluginsTypeApp:
				depType = string(plugins.TypeApp)
			case pluginsv0alpha1.MetaV0alpha1DependenciesPluginsTypeDatasource:
				depType = string(plugins.TypeDataSource)
			case pluginsv0alpha1.MetaV0alpha1DependenciesPluginsTypePanel:
				depType = string(plugins.TypePanel)
			}
			jsonData.Dependencies.Plugins = append(jsonData.Dependencies.Plugins, plugins.Dependency{
				ID:   dep.Id,
				Type: depType,
				Name: dep.Name,
			})
		}
	}

	if meta.Dependencies.Extensions != nil && len(meta.Dependencies.Extensions.ExposedComponents) > 0 {
		jsonData.Dependencies.Extensions = plugins.ExtensionsDependencies{
			ExposedComponents: meta.Dependencies.Extensions.ExposedComponents,
		}
	}

	// Map optional boolean fields
	if meta.Alerting != nil {
		jsonData.Alerting = *meta.Alerting
	}
	if meta.Annotations != nil {
		jsonData.Annotations = *meta.Annotations
	}
	if meta.AutoEnabled != nil {
		jsonData.AutoEnabled = *meta.AutoEnabled
	}
	if meta.Backend != nil {
		jsonData.Backend = *meta.Backend
	}
	if meta.BuiltIn != nil {
		jsonData.BuiltIn = *meta.BuiltIn
	}
	if meta.HideFromList != nil {
		jsonData.HideFromList = *meta.HideFromList
	}
	if meta.Logs != nil {
		jsonData.Logs = *meta.Logs
	}
	if meta.Metrics != nil {
		jsonData.Metrics = *meta.Metrics
	}
	if meta.MultiValueFilterOperators != nil {
		jsonData.MultiValueFilterOperators = *meta.MultiValueFilterOperators
	}
	if meta.Preload != nil {
		jsonData.Preload = *meta.Preload
	}
	if meta.SkipDataQuery != nil {
		jsonData.SkipDataQuery = *meta.SkipDataQuery
	}
	if meta.Streaming != nil {
		jsonData.Streaming = *meta.Streaming
	}
	if meta.Tracing != nil {
		jsonData.Tracing = *meta.Tracing
	}

	// Map category
	if meta.Category != nil {
		switch *meta.Category {
		case pluginsv0alpha1.MetaJSONDataCategoryTsdb:
			jsonData.Category = "tsdb"
		case pluginsv0alpha1.MetaJSONDataCategoryLogging:
			jsonData.Category = "logging"
		case pluginsv0alpha1.MetaJSONDataCategoryCloud:
			jsonData.Category = "cloud"
		case pluginsv0alpha1.MetaJSONDataCategoryTracing:
			jsonData.Category = "tracing"
		case pluginsv0alpha1.MetaJSONDataCategoryProfiling:
			jsonData.Category = "profiling"
		case pluginsv0alpha1.MetaJSONDataCategorySql:
			jsonData.Category = "sql"
		case pluginsv0alpha1.MetaJSONDataCategoryEnterprise:
			jsonData.Category = "enterprise"
		case pluginsv0alpha1.MetaJSONDataCategoryIot:
			jsonData.Category = "iot"
		case pluginsv0alpha1.MetaJSONDataCategoryOther:
			jsonData.Category = "other"
		}
	}

	// Map state
	if meta.State != nil {
		switch *meta.State {
		case pluginsv0alpha1.MetaJSONDataStateAlpha:
			jsonData.State = plugins.ReleaseStateAlpha
		case pluginsv0alpha1.MetaJSONDataStateBeta:
			jsonData.State = plugins.ReleaseStateBeta
		}
	}

	// Map executable
	if meta.Executable != nil {
		jsonData.Executable = *meta.Executable
	}

	// Map QueryOptions
	if meta.QueryOptions != nil {
		jsonData.QueryOptions = make(map[string]bool)
		if meta.QueryOptions.MaxDataPoints != nil {
			jsonData.QueryOptions["maxDataPoints"] = *meta.QueryOptions.MaxDataPoints
		}
		if meta.QueryOptions.MinInterval != nil {
			jsonData.QueryOptions["minInterval"] = *meta.QueryOptions.MinInterval
		}
		if meta.QueryOptions.CacheTimeout != nil {
			jsonData.QueryOptions["cacheTimeout"] = *meta.QueryOptions.CacheTimeout
		}
	}

	// Map Includes
	if len(meta.Includes) > 0 {
		jsonData.Includes = make([]*plugins.Includes, 0, len(meta.Includes))
		for _, inc := range meta.Includes {
			var incType string
			if inc.Type != nil {
				incType = string(*inc.Type)
			}
			includes := &plugins.Includes{
				Type: incType,
			}
			if inc.Name != nil {
				includes.Name = *inc.Name
			}
			if inc.Path != nil {
				includes.Path = *inc.Path
			}
			if inc.Icon != nil {
				includes.Icon = *inc.Icon
			}
			if inc.Role != nil {
				includes.Role = identity.RoleType(*inc.Role)
			}
			if inc.Component != nil {
				includes.Component = *inc.Component
			}
			if inc.Uid != nil {
				includes.UID = *inc.Uid
			}
			if inc.Action != nil {
				includes.Action = *inc.Action
			}
			if inc.AddToNav != nil {
				includes.AddToNav = *inc.AddToNav
			}
			if inc.DefaultNav != nil {
				includes.DefaultNav = *inc.DefaultNav
			}
			jsonData.Includes = append(jsonData.Includes, includes)
		}
	}

	// Map Routes
	if len(meta.Routes) > 0 {
		jsonData.Routes = make([]*plugins.Route, 0, len(meta.Routes))
		for _, route := range meta.Routes {
			r := &plugins.Route{}
			if route.Path != nil {
				r.Path = *route.Path
			}
			if route.Method != nil {
				r.Method = *route.Method
			}
			if route.Url != nil {
				r.URL = *route.Url
			}
			if route.ReqRole != nil {
				r.ReqRole = identity.RoleType(*route.ReqRole)
			}
			if route.ReqAction != nil {
				r.ReqAction = *route.ReqAction
			}
			if len(route.Headers) > 0 {
				r.Headers = make([]plugins.Header, 0, len(route.Headers))
				for _, header := range route.Headers {
					r.Headers = append(r.Headers, plugins.Header{
						Name:    header.Name,
						Content: header.Content,
					})
				}
			}
			if len(route.UrlParams) > 0 {
				r.URLParams = make([]plugins.URLParam, 0, len(route.UrlParams))
				for _, param := range route.UrlParams {
					p := plugins.URLParam{}
					if param.Name != nil {
						p.Name = *param.Name
					}
					if param.Content != nil {
						p.Content = *param.Content
					}
					r.URLParams = append(r.URLParams, p)
				}
			}
			if route.TokenAuth != nil {
				r.TokenAuth = &plugins.JWTTokenAuth{}
				if route.TokenAuth.Url != nil {
					r.TokenAuth.Url = *route.TokenAuth.Url
				}
				if len(route.TokenAuth.Scopes) > 0 {
					r.TokenAuth.Scopes = route.TokenAuth.Scopes
				}
				if len(route.TokenAuth.Params) > 0 {
					r.TokenAuth.Params = make(map[string]string)
					for k, v := range route.TokenAuth.Params {
						if strVal, ok := v.(string); ok {
							r.TokenAuth.Params[k] = strVal
						}
					}
				}
			}
			if route.JwtTokenAuth != nil {
				r.JwtTokenAuth = &plugins.JWTTokenAuth{}
				if route.JwtTokenAuth.Url != nil {
					r.JwtTokenAuth.Url = *route.JwtTokenAuth.Url
				}
				if len(route.JwtTokenAuth.Scopes) > 0 {
					r.JwtTokenAuth.Scopes = route.JwtTokenAuth.Scopes
				}
				if len(route.JwtTokenAuth.Params) > 0 {
					r.JwtTokenAuth.Params = make(map[string]string)
					for k, v := range route.JwtTokenAuth.Params {
						if strVal, ok := v.(string); ok {
							r.JwtTokenAuth.Params[k] = strVal
						}
					}
				}
			}
			if len(route.Body) > 0 {
				bodyBytes, err := json.Marshal(route.Body)
				if err == nil {
					r.Body = bodyBytes
				}
			}
			jsonData.Routes = append(jsonData.Routes, r)
		}
	}

	// Map Extensions
	if meta.Extensions != nil {
		extensions := plugins.Extensions{}
		if len(meta.Extensions.AddedLinks) > 0 {
			extensions.AddedLinks = make([]plugins.AddedLink, 0, len(meta.Extensions.AddedLinks))
			for _, link := range meta.Extensions.AddedLinks {
				extLink := plugins.AddedLink{
					Targets: link.Targets,
					Title:   link.Title,
				}
				if link.Description != nil {
					extLink.Description = *link.Description
				}
				extensions.AddedLinks = append(extensions.AddedLinks, extLink)
			}
		}
		if len(meta.Extensions.AddedComponents) > 0 {
			extensions.AddedComponents = make([]plugins.AddedComponent, 0, len(meta.Extensions.AddedComponents))
			for _, comp := range meta.Extensions.AddedComponents {
				extComp := plugins.AddedComponent{
					Targets: comp.Targets,
					Title:   comp.Title,
				}
				if comp.Description != nil {
					extComp.Description = *comp.Description
				}
				extensions.AddedComponents = append(extensions.AddedComponents, extComp)
			}
		}
		if len(meta.Extensions.AddedFunctions) > 0 {
			extensions.AddedFunctions = make([]plugins.AddedFunction, 0, len(meta.Extensions.AddedFunctions))
			for _, fn := range meta.Extensions.AddedFunctions {
				extFn := plugins.AddedFunction{
					Targets: fn.Targets,
					Title:   fn.Title,
				}
				if fn.Description != nil {
					extFn.Description = *fn.Description
				}
				extensions.AddedFunctions = append(extensions.AddedFunctions, extFn)
			}
		}
		if len(meta.Extensions.ExposedComponents) > 0 {
			extensions.ExposedComponents = make([]plugins.ExposedComponent, 0, len(meta.Extensions.ExposedComponents))
			for _, comp := range meta.Extensions.ExposedComponents {
				extComp := plugins.ExposedComponent{
					Id: comp.Id,
				}
				if comp.Title != nil {
					extComp.Title = *comp.Title
				}
				if comp.Description != nil {
					extComp.Description = *comp.Description
				}
				extensions.ExposedComponents = append(extensions.ExposedComponents, extComp)
			}
		}
		if len(meta.Extensions.ExtensionPoints) > 0 {
			extensions.ExtensionPoints = make([]plugins.ExtensionPoint, 0, len(meta.Extensions.ExtensionPoints))
			for _, point := range meta.Extensions.ExtensionPoints {
				extPoint := plugins.ExtensionPoint{
					Id: point.Id,
				}
				if point.Title != nil {
					extPoint.Title = *point.Title
				}
				if point.Description != nil {
					extPoint.Description = *point.Description
				}
				extensions.ExtensionPoints = append(extensions.ExtensionPoints, extPoint)
			}
		}
		jsonData.Extensions = extensions
	}

	// Map IAM
	if meta.Iam != nil && len(meta.Iam.Permissions) > 0 {
		iam := &auth.IAM{
			Permissions: make([]auth.Permission, 0, len(meta.Iam.Permissions)),
		}
		for _, perm := range meta.Iam.Permissions {
			p := auth.Permission{}
			if perm.Action != nil {
				p.Action = *perm.Action
			}
			if perm.Scope != nil {
				p.Scope = *perm.Scope
			}
			iam.Permissions = append(iam.Permissions, p)
		}
		jsonData.IAM = iam
	}

	// Map Roles
	if len(meta.Roles) > 0 {
		jsonData.Roles = make([]plugins.RoleRegistration, 0, len(meta.Roles))
		for _, role := range meta.Roles {
			reg := plugins.RoleRegistration{
				Grants: role.Grants,
			}
			if role.Role != nil {
				reg.Role = plugins.Role{}
				if role.Role.Name != nil {
					reg.Role.Name = *role.Role.Name
				}
				if role.Role.Description != nil {
					reg.Role.Description = *role.Role.Description
				}
				if len(role.Role.Permissions) > 0 {
					reg.Role.Permissions = make([]plugins.Permission, 0, len(role.Role.Permissions))
					for _, perm := range role.Role.Permissions {
						p := plugins.Permission{}
						if perm.Action != nil {
							p.Action = *perm.Action
						}
						if perm.Scope != nil {
							p.Scope = *perm.Scope
						}
						reg.Role.Permissions = append(reg.Role.Permissions, p)
					}
				}
			}
			jsonData.Roles = append(jsonData.Roles, reg)
		}
	}

	return jsonData
}

// pluginStorePluginToMeta converts a pluginstore.Plugin to a pluginsv0alpha1.MetaSpec.
// This is similar to pluginToPluginMetaSpec but works with the plugin store DTO.
// loadingStrategy and moduleHash are optional calculated values that can be provided.
func pluginStorePluginToMeta(plugin pluginstore.Plugin, moduleHash string) pluginsv0alpha1.MetaSpec {
	metaSpec := pluginsv0alpha1.MetaSpec{
		PluginJson: jsonDataToMetaJSONData(plugin.JSONData),
	}

	// Set Class - default to External if not specified
	var c pluginsv0alpha1.MetaSpecClass
	if plugin.Class == plugins.ClassCore {
		c = pluginsv0alpha1.MetaSpecClassCore
	} else {
		c = pluginsv0alpha1.MetaSpecClassExternal
	}
	metaSpec.Class = c

	if plugin.Module != "" {
		module := &pluginsv0alpha1.MetaV0alpha1SpecModule{
			Path: plugin.Module,
		}
		if moduleHash != "" {
			module.Hash = &moduleHash
		}
		if plugin.LoadingStrategy != "" {
			var ls pluginsv0alpha1.MetaV0alpha1SpecModuleLoadingStrategy
			switch plugin.LoadingStrategy {
			case plugins.LoadingStrategyFetch:
				ls = pluginsv0alpha1.MetaV0alpha1SpecModuleLoadingStrategyFetch
			case plugins.LoadingStrategyScript:
				ls = pluginsv0alpha1.MetaV0alpha1SpecModuleLoadingStrategyScript
			}
			module.LoadingStrategy = &ls
		}
		metaSpec.Module = module
	}

	if plugin.BaseURL != "" {
		metaSpec.BaseURL = &plugin.BaseURL
	}

	if plugin.Signature != "" {
		signature := &pluginsv0alpha1.MetaV0alpha1SpecSignature{
			Status: convertSignatureStatus(plugin.Signature),
		}

		if plugin.SignatureType != "" {
			sigType := convertSignatureType(plugin.SignatureType)
			signature.Type = &sigType
		}

		if plugin.SignatureOrg != "" {
			signature.Org = &plugin.SignatureOrg
		}

		metaSpec.Signature = signature
	}

	if len(plugin.Children) > 0 {
		metaSpec.Children = plugin.Children
	}

	if len(plugin.Translations) > 0 {
		metaSpec.Translations = plugin.Translations
	}

	return metaSpec
}

// convertSignatureStatus converts plugins.SignatureStatus to pluginsv0alpha1.MetaV0alpha1SpecSignatureStatus.
func convertSignatureStatus(status plugins.SignatureStatus) pluginsv0alpha1.MetaV0alpha1SpecSignatureStatus {
	switch status {
	case plugins.SignatureStatusInternal:
		return pluginsv0alpha1.MetaV0alpha1SpecSignatureStatusInternal
	case plugins.SignatureStatusValid:
		return pluginsv0alpha1.MetaV0alpha1SpecSignatureStatusValid
	case plugins.SignatureStatusInvalid:
		return pluginsv0alpha1.MetaV0alpha1SpecSignatureStatusInvalid
	case plugins.SignatureStatusModified:
		return pluginsv0alpha1.MetaV0alpha1SpecSignatureStatusModified
	case plugins.SignatureStatusUnsigned:
		return pluginsv0alpha1.MetaV0alpha1SpecSignatureStatusUnsigned
	default:
		return pluginsv0alpha1.MetaV0alpha1SpecSignatureStatusUnsigned
	}
}

// convertSignatureType converts plugins.SignatureType to pluginsv0alpha1.MetaV0alpha1SpecSignatureType.
func convertSignatureType(sigType plugins.SignatureType) pluginsv0alpha1.MetaV0alpha1SpecSignatureType {
	switch sigType {
	case plugins.SignatureTypeGrafana:
		return pluginsv0alpha1.MetaV0alpha1SpecSignatureTypeGrafana
	case plugins.SignatureTypeCommercial:
		return pluginsv0alpha1.MetaV0alpha1SpecSignatureTypeCommercial
	case plugins.SignatureTypeCommunity:
		return pluginsv0alpha1.MetaV0alpha1SpecSignatureTypeCommunity
	case plugins.SignatureTypePrivate:
		return pluginsv0alpha1.MetaV0alpha1SpecSignatureTypePrivate
	case plugins.SignatureTypePrivateGlob:
		return pluginsv0alpha1.MetaV0alpha1SpecSignatureTypePrivateGlob
	default:
		return pluginsv0alpha1.MetaV0alpha1SpecSignatureTypeGrafana
	}
}

// pluginToMetaSpec converts a fully loaded *plugins.Plugin to a pluginsv0alpha1.MetaSpec.
func pluginToMetaSpec(plugin *plugins.Plugin) pluginsv0alpha1.MetaSpec {
	metaSpec := pluginsv0alpha1.MetaSpec{
		PluginJson: jsonDataToMetaJSONData(plugin.JSONData),
	}

	// Set Class - default to External if not specified
	var c pluginsv0alpha1.MetaSpecClass
	if plugin.Class == plugins.ClassCore {
		c = pluginsv0alpha1.MetaSpecClassCore
	} else {
		c = pluginsv0alpha1.MetaSpecClassExternal
	}
	metaSpec.Class = c

	// Set module information
	if plugin.Module != "" {
		module := &pluginsv0alpha1.MetaV0alpha1SpecModule{
			Path: plugin.Module,
		}

		loadingStrategy := pluginsv0alpha1.MetaV0alpha1SpecModuleLoadingStrategyScript
		module.LoadingStrategy = &loadingStrategy

		metaSpec.Module = module
	}

	// Set BaseURL
	if plugin.BaseURL != "" {
		metaSpec.BaseURL = &plugin.BaseURL
	}

	// Set signature information
	signature := &pluginsv0alpha1.MetaV0alpha1SpecSignature{
		Status: convertSignatureStatus(plugin.Signature),
	}

	if plugin.SignatureType != "" {
		sigType := convertSignatureType(plugin.SignatureType)
		signature.Type = &sigType
	}

	if plugin.SignatureOrg != "" {
		signature.Org = &plugin.SignatureOrg
	}

	metaSpec.Signature = signature

	if len(plugin.Children) > 0 {
		children := make([]string, 0, len(plugin.Children))
		for _, child := range plugin.Children {
			children = append(children, child.ID)
		}
		metaSpec.Children = children
	}

	if len(plugin.Translations) > 0 {
		metaSpec.Translations = plugin.Translations
	}

	return metaSpec
}

// grafanaComPluginVersionMeta represents the response from grafana.com API
// GET /api/plugins/{pluginId}/versions/{version}
type grafanaComPluginVersionMeta struct {
	PluginID        string                       `json:"pluginSlug"`
	Version         string                       `json:"version"`
	URL             string                       `json:"url"`
	Commit          string                       `json:"commit"`
	Description     string                       `json:"description"`
	Keywords        []string                     `json:"keywords"`
	CreatedAt       time.Time                    `json:"createdAt"`
	UpdatedAt       time.Time                    `json:"updatedAt"`
	JSON            pluginsv0alpha1.MetaJSONData `json:"json"`
	Readme          string                       `json:"readme"`
	Downloads       int                          `json:"downloads"`
	Verified        bool                         `json:"verified"`
	Status          string                       `json:"status"`
	StatusContext   string                       `json:"statusContext"`
	DownloadSlug    string                       `json:"downloadSlug"`
	SignatureType   string                       `json:"signatureType"`
	SignedByOrg     string                       `json:"signedByOrg"`
	SignedByOrgName string                       `json:"signedByOrgName"`
	Packages        struct {
		Any struct {
			Md5         string `json:"md5"`
			Sha256      string `json:"sha256"`
			PackageName string `json:"packageName"`
			DownloadURL string `json:"downloadUrl"`
		} `json:"any"`
	} `json:"packages"`
	Links []struct {
		Rel  string `json:"rel"`
		Href string `json:"href"`
	} `json:"links"`
	Scopes   []string                           `json:"scopes"`
	CDNURL   string                             `json:"cdnUrl"`
	Children []grafanaComChildPluginVersionMeta `json:"children"`
}

type grafanaComChildPluginVersionMeta struct {
	ID   int                          `json:"id"`
	Path string                       `json:"path"`
	Slug string                       `json:"slug"`
	JSON pluginsv0alpha1.MetaJSONData `json:"json"`
}
