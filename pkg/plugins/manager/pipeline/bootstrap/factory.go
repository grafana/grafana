package bootstrap

import (
	"fmt"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/assetpath"
	"github.com/grafana/grafana/pkg/plugins/pluginassets"
)

type pluginFactoryFunc func(p *plugins.FoundBundle, pluginClass plugins.Class, sig plugins.Signature) (*plugins.Plugin, error)

// DefaultPluginFactory is the default plugin factory used by the Construct step of the Bootstrap stage.
//
// It creates the plugin using plugin information found during the Discovery stage and makes use of the assetPath
// service to set the plugin's BaseURL, Module, Logos and Screenshots fields.
type DefaultPluginFactory struct {
	assetPath *assetpath.Service
	features  *config.Features
}

// NewDefaultPluginFactory returns a new DefaultPluginFactory.
func NewDefaultPluginFactory(features *config.Features, assetPath *assetpath.Service) *DefaultPluginFactory {
	return &DefaultPluginFactory{assetPath: assetPath, features: features}
}

func (f *DefaultPluginFactory) createPlugin(bundle *plugins.FoundBundle, class plugins.Class,
	sig plugins.Signature) (*plugins.Plugin, error) {
	parentInfo := pluginassets.NewPluginInfo(bundle.Primary.JSONData, class, bundle.Primary.FS, nil)
	plugin, err := f.newPlugin(bundle.Primary, class, sig, parentInfo)
	if err != nil {
		return nil, err
	}

	if len(bundle.Children) == 0 {
		return plugin, nil
	}

	plugin.Children = make([]*plugins.Plugin, 0, len(bundle.Children))
	for _, child := range bundle.Children {
		childInfo := pluginassets.NewPluginInfo(child.JSONData, class, child.FS, &parentInfo)
		cp, err := f.newPlugin(*child, class, sig, childInfo)
		if err != nil {
			return nil, err
		}
		cp.Parent = plugin
		plugin.Children = append(plugin.Children, cp)
	}

	return plugin, nil
}

func (f *DefaultPluginFactory) newPlugin(p plugins.FoundPlugin, class plugins.Class, sig plugins.Signature,
	info pluginassets.PluginInfo) (*plugins.Plugin, error) {
	baseURL, err := f.assetPath.Base(info)
	if err != nil {
		return nil, fmt.Errorf("base url: %w", err)
	}
	moduleURL, err := f.assetPath.Module(info)
	if err != nil {
		return nil, fmt.Errorf("module url: %w", err)
	}
	plugin := &plugins.Plugin{
		JSONData:      p.JSONData,
		Class:         class,
		FS:            p.FS,
		BaseURL:       baseURL,
		Module:        moduleURL,
		Signature:     sig.Status,
		SignatureType: sig.Type,
		SignatureOrg:  sig.SigningOrg,
	}

	plugin.SetLogger(log.New(fmt.Sprintf("plugin.%s", plugin.ID)))
	if err = setImages(plugin, f.assetPath, info); err != nil {
		return nil, err
	}

	if err := setTranslations(plugin, f.assetPath, info); err != nil {
		return nil, err
	}

	return plugin, nil
}

func setImages(p *plugins.Plugin, assetPath *assetpath.Service, info pluginassets.PluginInfo) error {
	var err error
	for _, dst := range []*string{&p.Info.Logos.Small, &p.Info.Logos.Large} {
		if len(*dst) == 0 {
			*dst = assetPath.DefaultLogoPath(p.Type)
			continue
		}

		*dst, err = assetPath.RelativeURL(info, *dst)
		if err != nil {
			return fmt.Errorf("logo: %w", err)
		}
	}
	for i := 0; i < len(p.Info.Screenshots); i++ {
		screenshot := &p.Info.Screenshots[i]
		screenshot.Path, err = assetPath.RelativeURL(info, screenshot.Path)
		if err != nil {
			return fmt.Errorf("screenshot %d relative url: %w", i, err)
		}
	}
	return nil
}

func setTranslations(p *plugins.Plugin, assetPath *assetpath.Service, info pluginassets.PluginInfo) error {
	translations, err := assetPath.GetTranslations(info)
	if err != nil {
		return fmt.Errorf("set translations: %w", err)
	}

	p.Translations = translations
	return nil
}
