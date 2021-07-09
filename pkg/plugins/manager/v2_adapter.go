package manager

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
)

func fromV2(v2 *plugins.PluginV2) *plugins.PluginBase {
	if v2 == nil {
		return nil
	}

	p := &plugins.PluginBase{
		Type: v2.Type,
		Name: v2.Name,
		Id:   v2.ID,
		Info: plugins.PluginInfo{
			Author: plugins.PluginInfoLink{
				Name: v2.Info.Author.Name,
				Url:  v2.Info.Author.Url,
			},
			Description: v2.Info.Description,
			Logos: plugins.PluginLogos{
				Small: v2.Info.Logos.Small,
				Large: v2.Info.Logos.Large,
			},
			Build: plugins.PluginBuildInfo{
				Time:   v2.Info.Build.Time,
				Repo:   v2.Info.Build.Repo,
				Branch: v2.Info.Build.Branch,
				Hash:   v2.Info.Build.Hash,
			},
			Version: v2.Info.Version,
			Updated: v2.Info.Updated,
		},
		Dependencies: plugins.PluginDependencies{
			GrafanaVersion: v2.Dependencies.GrafanaVersion,
		},
		Module:              v2.Module,
		BaseUrl:             v2.BaseUrl,
		Category:            v2.Category,
		HideFromList:        v2.HideFromList,
		Preload:             v2.Preload,
		State:               plugins.PluginState(v2.State),
		Signature:           plugins.PluginSignatureStatus(v2.Signature),
		Backend:             v2.Backend,
		IncludedInAppId:     v2.IncludedInAppID,
		PluginDir:           v2.PluginDir,
		DefaultNavUrl:       v2.DefaultNavURL,
		IsCorePlugin:        v2.IsCorePlugin(),
		SignatureType:       plugins.PluginSignatureType(v2.SignatureType),
		SignatureOrg:        v2.SignatureOrg,
		GrafanaNetVersion:   v2.GrafanaComVersion,
		GrafanaNetHasUpdate: v2.GrafanaComHasUpdate,
		Root:                fromV2(v2.Parent),
	}

	for _, include := range v2.Includes {
		p.Includes = append(p.Includes, &plugins.PluginInclude{
			Name:       include.Name,
			Path:       include.Path,
			Type:       include.Type,
			Component:  include.Component,
			Role:       models.RoleType(include.Role),
			AddToNav:   include.AddToNav,
			DefaultNav: include.DefaultNav,
			Slug:       include.Slug,
			Icon:       include.Icon,
			Id:         include.Id,
		})
	}

	for _, depPlugin := range v2.Dependencies.Plugins {
		p.Dependencies.Plugins = append(p.Dependencies.Plugins,
			plugins.PluginDependencyItem{
				Type:    depPlugin.Type,
				Id:      depPlugin.Id,
				Name:    depPlugin.Name,
				Version: depPlugin.Version,
			})
	}

	for _, link := range v2.Info.Links {
		p.Info.Links = append(p.Info.Links, plugins.PluginInfoLink{
			Name: link.Name,
			Url:  link.Url,
		})
	}

	for _, screenshot := range v2.Info.Screenshots {
		p.Info.Screenshots = append(p.Info.Screenshots, plugins.PluginScreenshots{
			Name: screenshot.Name,
			Path: screenshot.Path,
		})
	}

	return p
}

func dataSourceFromV2(v2 *plugins.PluginV2) *plugins.DataSourcePlugin {
	if v2 == nil || !v2.IsDataSource() {
		return nil
	}

	ds := &plugins.DataSourcePlugin{
		FrontendPluginBase: plugins.FrontendPluginBase{
			PluginBase: *fromV2(v2),
		},
		Annotations:  v2.Annotations,
		Metrics:      v2.Metrics,
		Alerting:     v2.Alerting,
		Explore:      v2.Explore,
		Table:        v2.Table,
		Logs:         v2.Logs,
		Tracing:      v2.Tracing,
		QueryOptions: v2.QueryOptions,
		BuiltIn:      v2.BuiltIn,
		Mixed:        v2.Mixed,
		Streaming:    v2.Streaming,
		Backend:      v2.Backend,
		Executable:   v2.Executable,
		SDK:          v2.SDK,
	}

	for _, route := range v2.Routes {
		r := &plugins.AppPluginRoute{
			Path:     route.Path,
			Method:   route.Method,
			ReqRole:  models.RoleType(route.ReqRole),
			URL:      route.URL,
			AuthType: route.AuthType,
			Body:     route.Body,
		}

		if route.TokenAuth != nil {
			r.TokenAuth = &plugins.JwtTokenAuth{
				Url:    route.TokenAuth.Url,
				Scopes: route.TokenAuth.Scopes,
				Params: route.TokenAuth.Params,
			}
		}
		if route.JwtTokenAuth != nil {
			r.JwtTokenAuth = &plugins.JwtTokenAuth{
				Url:    route.JwtTokenAuth.Url,
				Scopes: route.JwtTokenAuth.Scopes,
				Params: route.JwtTokenAuth.Params,
			}
		}

		for _, urlParam := range route.URLParams {
			r.URLParams = append(r.URLParams, plugins.AppPluginRouteURLParam{
				Name:    urlParam.Name,
				Content: urlParam.Content,
			})
		}

		for _, header := range route.Headers {
			r.Headers = append(r.Headers, plugins.AppPluginRouteHeader{
				Name:    header.Name,
				Content: header.Content,
			})
		}
	}

	return ds
}

func panelFromV2(v2 *plugins.PluginV2) *plugins.PanelPlugin {
	if v2 == nil || !v2.IsPanel() {
		return nil
	}

	p := &plugins.PanelPlugin{
		FrontendPluginBase: plugins.FrontendPluginBase{
			PluginBase: *fromV2(v2),
		},
		SkipDataQuery: v2.SkipDataQuery,
	}

	return p
}

func appFromV2(v2 *plugins.PluginV2) *plugins.AppPlugin {
	if v2 == nil || !v2.IsApp() {
		return nil
	}

	app := &plugins.AppPlugin{
		FrontendPluginBase: plugins.FrontendPluginBase{
			PluginBase: *fromV2(v2),
		},
		AutoEnabled: v2.AutoEnabled,
		Pinned:      v2.Pinned,
		Executable:  v2.Executable,
	}

	for _, route := range v2.Routes {
		r := &plugins.AppPluginRoute{
			Path:     route.Path,
			Method:   route.Method,
			ReqRole:  models.RoleType(route.ReqRole),
			URL:      route.URL,
			AuthType: route.AuthType,
			TokenAuth: &plugins.JwtTokenAuth{
				Url:    route.TokenAuth.Url,
				Scopes: route.TokenAuth.Scopes,
				Params: route.TokenAuth.Params,
			},
			JwtTokenAuth: &plugins.JwtTokenAuth{
				Url:    route.JwtTokenAuth.Url,
				Scopes: route.JwtTokenAuth.Scopes,
				Params: route.JwtTokenAuth.Params,
			},
			Body: route.Body,
		}

		for _, urlParam := range route.URLParams {
			r.URLParams = append(r.URLParams, plugins.AppPluginRouteURLParam{
				Name:    urlParam.Name,
				Content: urlParam.Content,
			})
		}

		for _, header := range route.Headers {
			r.Headers = append(r.Headers, plugins.AppPluginRouteHeader{
				Name:    header.Name,
				Content: header.Content,
			})
		}
	}

	return app
}

func rendererFromV2(v2 *plugins.PluginV2) *plugins.RendererPlugin {
	if v2 == nil || !v2.IsRenderer() {
		return nil
	}

	renderer := &plugins.RendererPlugin{
		FrontendPluginBase: plugins.FrontendPluginBase{
			PluginBase: *fromV2(v2),
		},
		Executable:   v2.Executable,
		GrpcPluginV2: v2.Renderer,
	}

	return renderer
}
