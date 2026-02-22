package appplugin

import (
	"context"
	"errors"
	"fmt"
	"path"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	apppluginv0alpha1 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginassets"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
)

type pluginUpdateChecker interface {
	HasUpdate(ctx context.Context, pluginID string) (string, bool)
}

// settingsStorage serves the "settings" resource as a read-only singleton named "current".
type settingsStorage struct {
	pluginID             string
	pluginStore          pluginstore.Store
	pluginSettings       pluginsettings.Service
	pluginsUpdateChecker pluginUpdateChecker
	pluginAssets         *pluginassets.Service
	cfg                  *setting.Cfg
	resource             schema.GroupResource
}

var (
	_ rest.Storage              = (*settingsStorage)(nil)
	_ rest.Getter               = (*settingsStorage)(nil)
	_ rest.Scoper               = (*settingsStorage)(nil)
	_ rest.SingularNameProvider = (*settingsStorage)(nil)
)

func (s *settingsStorage) New() runtime.Object {
	return &apppluginv0alpha1.Settings{}
}

func (s *settingsStorage) Destroy() {}

func (s *settingsStorage) NamespaceScoped() bool {
	return true
}

func (s *settingsStorage) GetSingularName() string {
	return "settings"
}

func (s *settingsStorage) Get(ctx context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	if name != "current" {
		return nil, apierrors.NewNotFound(s.resource, name)
	}

	nsInfo, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	plugin, exists := s.pluginStore.Plugin(ctx, s.pluginID)
	if !exists {
		return nil, fmt.Errorf("plugin %s not found", s.pluginID)
	}

	includes := make([]*apppluginv0alpha1.PluginInclude, 0, len(plugin.Includes))
	for _, inc := range plugin.Includes {
		if inc == nil {
			continue
		}
		includes = append(includes, &apppluginv0alpha1.PluginInclude{
			Name:       inc.Name,
			Path:       inc.Path,
			Type:       inc.Type,
			Component:  inc.Component,
			Role:       string(inc.Role),
			Action:     inc.Action,
			AddToNav:   inc.AddToNav,
			DefaultNav: inc.DefaultNav,
			Slug:       inc.Slug,
			Icon:       inc.Icon,
			UID:        inc.UID,
		})
	}

	depPlugins := make([]apppluginv0alpha1.PluginDependency, 0, len(plugin.Dependencies.Plugins))
	for _, d := range plugin.Dependencies.Plugins {
		depPlugins = append(depPlugins, apppluginv0alpha1.PluginDependency{
			ID:   d.ID,
			Type: d.Type,
			Name: d.Name,
		})
	}

	infoLinks := make([]apppluginv0alpha1.PluginInfoLink, 0, len(plugin.Info.Links))
	for _, l := range plugin.Info.Links {
		infoLinks = append(infoLinks, apppluginv0alpha1.PluginInfoLink{
			Name: l.Name,
			URL:  l.URL,
		})
	}

	screenshots := make([]apppluginv0alpha1.PluginScreenshot, 0, len(plugin.Info.Screenshots))
	for _, sc := range plugin.Info.Screenshots {
		screenshots = append(screenshots, apppluginv0alpha1.PluginScreenshot{
			Name: sc.Name,
			Path: sc.Path,
		})
	}

	addedLinks := make([]apppluginv0alpha1.PluginExtensionLink, 0, len(plugin.Extensions.AddedLinks))
	for _, l := range plugin.Extensions.AddedLinks {
		addedLinks = append(addedLinks, apppluginv0alpha1.PluginExtensionLink{
			Targets:     l.Targets,
			Title:       l.Title,
			Description: l.Description,
		})
	}

	addedComponents := make([]apppluginv0alpha1.PluginExtensionComponent, 0, len(plugin.Extensions.AddedComponents))
	for _, c := range plugin.Extensions.AddedComponents {
		addedComponents = append(addedComponents, apppluginv0alpha1.PluginExtensionComponent{
			Targets:     c.Targets,
			Title:       c.Title,
			Description: c.Description,
		})
	}

	exposedComponents := make([]apppluginv0alpha1.PluginExposedComponent, 0, len(plugin.Extensions.ExposedComponents))
	for _, e := range plugin.Extensions.ExposedComponents {
		exposedComponents = append(exposedComponents, apppluginv0alpha1.PluginExposedComponent{
			ID:          e.Id,
			Title:       e.Title,
			Description: e.Description,
		})
	}

	extensionPoints := make([]apppluginv0alpha1.PluginExtensionPoint, 0, len(plugin.Extensions.ExtensionPoints))
	for _, ep := range plugin.Extensions.ExtensionPoints {
		extensionPoints = append(extensionPoints, apppluginv0alpha1.PluginExtensionPoint{
			ID:          ep.Id,
			Title:       ep.Title,
			Description: ep.Description,
		})
	}

	addedFunctions := make([]apppluginv0alpha1.PluginExtensionFunction, 0, len(plugin.Extensions.AddedFunctions))
	for _, f := range plugin.Extensions.AddedFunctions {
		addedFunctions = append(addedFunctions, apppluginv0alpha1.PluginExtensionFunction{
			Targets:     f.Targets,
			Title:       f.Title,
			Description: f.Description,
		})
	}

	obj := &apppluginv0alpha1.Settings{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: nsInfo.Value,
		},
		Spec: apppluginv0alpha1.SettingsSpec{
			Name:        plugin.Name,
			Type:        string(plugin.Type),
			ID:          plugin.ID,
			Enabled:     plugin.AutoEnabled,
			Pinned:      plugin.AutoEnabled,
			AutoEnabled: plugin.AutoEnabled,
			Module:      plugin.Module,
			BaseURL:     plugin.BaseURL,
			Info: apppluginv0alpha1.PluginInfo{
				Author: apppluginv0alpha1.PluginInfoLink{
					Name: plugin.Info.Author.Name,
					URL:  plugin.Info.Author.URL,
				},
				Description: plugin.Info.Description,
				Links:       infoLinks,
				Logos: apppluginv0alpha1.PluginLogos{
					Small: plugin.Info.Logos.Small,
					Large: plugin.Info.Logos.Large,
				},
				Build: apppluginv0alpha1.PluginBuildInfo{
					Time: plugin.Info.Build.Time,
				},
				Screenshots: screenshots,
				Version:     plugin.Info.Version,
				Updated:     plugin.Info.Updated,
				Keywords:    plugin.Info.Keywords,
			},
			Includes: includes,
			Dependencies: apppluginv0alpha1.PluginDeps{
				GrafanaDependency: plugin.Dependencies.GrafanaDependency,
				GrafanaVersion:    plugin.Dependencies.GrafanaVersion,
				Plugins:           depPlugins,
				Extensions: apppluginv0alpha1.ExtensionsDeps{
					ExposedComponents: plugin.Dependencies.Extensions.ExposedComponents,
				},
			},
			Extensions: apppluginv0alpha1.PluginExtensions{
				AddedLinks:        addedLinks,
				AddedComponents:   addedComponents,
				ExposedComponents: exposedComponents,
				ExtensionPoints:   extensionPoints,
				AddedFunctions:    addedFunctions,
			},
			DefaultNavURL:    path.Join(s.cfg.AppSubURL, plugin.DefaultNavURL),
			State:            string(plugin.State),
			Signature:        string(plugin.Signature),
			SignatureType:    string(plugin.SignatureType),
			SignatureOrg:     plugin.SignatureOrg,
			SecureJsonFields: map[string]bool{},
			AngularDetected:  plugin.Angular.Detected,
			LoadingStrategy:  string(plugin.LoadingStrategy),
			ModuleHash:       s.pluginAssets.ModuleHash(ctx, plugin),
			Translations:     plugin.Translations,
		},
	}

	if s.pluginsUpdateChecker != nil {
		if latestVersion, exists := s.pluginsUpdateChecker.HasUpdate(ctx, s.pluginID); exists {
			obj.Spec.LatestVersion = latestVersion
			obj.Spec.HasUpdate = true
		}
	}

	ps, err := s.pluginSettings.GetPluginSettingByPluginID(ctx, &pluginsettings.GetByPluginIDArgs{
		PluginID: s.pluginID,
		OrgID:    nsInfo.OrgID,
	})
	if err != nil {
		if !errors.Is(err, pluginsettings.ErrPluginSettingNotFound) {
			return nil, fmt.Errorf("failed to get plugin settings: %w", err)
		}
	} else {
		obj.Spec.Enabled = ps.Enabled
		obj.Spec.Pinned = ps.Pinned
		obj.Spec.JsonData = common.Unstructured{Object: ps.JSONData}

		secureFields := map[string]bool{}
		for k, v := range ps.SecureJSONData {
			secureFields[k] = len(v) > 0
		}
		obj.Spec.SecureJsonFields = secureFields
	}

	return obj, nil
}
