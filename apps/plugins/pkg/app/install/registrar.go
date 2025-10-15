package install

import (
	"context"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	errorsK8s "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
)

const (
	PluginInstallSourceAnnotation = "plugins.grafana.app/install-source"
)

type Class = string

const (
	ClassCore     Class = "core"
	ClassExternal Class = "external"
	ClassCDN      Class = "cdn"
)

type Source = string

const (
	SourceUnknown     Source = "unknown"
	SourcePluginStore Source = "plugin-store"
)

type PluginInstall struct {
	ID      string
	Version string
	URL     string
	Class   Class
	Source  Source
}

type InstallRegistrar struct {
	clientGenerator resource.ClientGenerator
}

func NewInstallRegistrar(clientGenerator resource.ClientGenerator) *InstallRegistrar {
	return &InstallRegistrar{
		clientGenerator: clientGenerator,
	}
}

func (r *InstallRegistrar) Register(ctx context.Context, namespace string, install *PluginInstall) error {
	log := logging.FromContext(ctx)
	client, err := pluginsv0alpha1.NewPluginInstallClientFromGenerator(r.clientGenerator)
	if err != nil {
		return nil
	}
	identifier := resource.Identifier{
		Namespace: namespace,
		Name:      install.ID,
	}

	existing, err := client.Get(ctx, identifier)
	if err != nil && !errorsK8s.IsNotFound(err) {
		return err
	}

	if existing != nil {
		if source, ok := existing.Annotations[PluginInstallSourceAnnotation]; !ok || source != install.Source {
			log.Debug("Skipping plugin installation as it already exists with a different install source", "pluginId", install.ID, "existingSource", source)
			return nil
		}

		if existing.Spec.Version == install.Version {
			log.Debug("Plugin install resource already exists with the same version", "pluginId", install.ID, "version", install.Version)
			return nil
		}
	}
	pluginInstall := &pluginsv0alpha1.PluginInstall{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: namespace,
			Name:      install.ID,
			Annotations: map[string]string{
				PluginInstallSourceAnnotation: install.Source,
			},
		},
		Spec: pluginsv0alpha1.PluginInstallSpec{
			Id:      install.ID,
			Version: install.Version,
			Url:     install.URL,
			Class:   pluginsv0alpha1.PluginInstallSpecClass(install.Class),
		},
	}

	if existing != nil {
		_, err = client.Update(ctx, pluginInstall, resource.UpdateOptions{})
		if err != nil {
			return err
		}
	} else {
		_, err = client.Create(ctx, pluginInstall, resource.CreateOptions{})
		if err != nil {
			return err
		}
	}

	return nil
}
