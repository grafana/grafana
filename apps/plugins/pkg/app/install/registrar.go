package install

import (
	"context"
	"sync"

	"github.com/grafana/grafana-app-sdk/resource"
	errorsK8s "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
)

const (
	PluginInstallSourceAnnotation = "plugins.grafana.app/install-source"
)

// Class represents the plugin class type in an unversioned internal format.
// This intentionally duplicates the versioned API type (PluginInstallSpecClass) to decouple
// internal code from API version changes, making it easier to support multiple API versions.
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

func (p *PluginInstall) ToPluginInstallV0Alpha1(namespace string) *pluginsv0alpha1.PluginInstall {
	var url *string = nil
	if p.URL != "" {
		url = &p.URL
	}
	return &pluginsv0alpha1.PluginInstall{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: namespace,
			Name:      p.ID,
			Annotations: map[string]string{
				PluginInstallSourceAnnotation: p.Source,
			},
		},
		Spec: pluginsv0alpha1.PluginInstallSpec{
			Id:      p.ID,
			Version: p.Version,
			Url:     url,
			Class:   pluginsv0alpha1.PluginInstallSpecClass(p.Class),
		},
	}
}

func (p *PluginInstall) ShouldUpdate(existing *pluginsv0alpha1.PluginInstall) bool {
	update := p.ToPluginInstallV0Alpha1(existing.Namespace)
	if source, ok := existing.Annotations[PluginInstallSourceAnnotation]; ok && source != p.Source {
		return true
	}
	if existing.Spec.Version != update.Spec.Version {
		return true
	}
	if existing.Spec.Class != update.Spec.Class {
		return true // this should never really happen
	}
	if !equalStringPointers(existing.Spec.Url, update.Spec.Url) {
		return true
	}
	return false
}

func equalStringPointers(a, b *string) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}

type InstallRegistrar struct {
	clientGenerator resource.ClientGenerator
	client          *pluginsv0alpha1.PluginInstallClient
	clientOnce      sync.Once
}

func NewInstallRegistrar(clientGenerator resource.ClientGenerator) *InstallRegistrar {
	return &InstallRegistrar{
		clientGenerator: clientGenerator,
		clientOnce:      sync.Once{},
	}
}

func (r *InstallRegistrar) GetClient() (*pluginsv0alpha1.PluginInstallClient, error) {
	r.clientOnce.Do(func() {
		client, err := pluginsv0alpha1.NewPluginInstallClientFromGenerator(r.clientGenerator)
		if err != nil {
			r.client = nil
			return
		}
		r.client = client
	})

	return r.client, nil
}

// Register creates or updates a plugin install in the registry.
func (r *InstallRegistrar) Register(ctx context.Context, namespace string, install *PluginInstall) error {
	client, err := r.GetClient()
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

	if existing != nil && install.ShouldUpdate(existing) {
		_, err = client.Update(ctx, install.ToPluginInstallV0Alpha1(namespace), resource.UpdateOptions{ResourceVersion: existing.ResourceVersion})
		return err
	}

	_, err = client.Create(ctx, install.ToPluginInstallV0Alpha1(namespace), resource.CreateOptions{})
	return err
}

// Unregister removes a plugin install from the registry.
func (r *InstallRegistrar) Unregister(ctx context.Context, namespace string, name string, source Source) error {
	client, err := r.GetClient()
	if err != nil {
		return err
	}
	identifier := resource.Identifier{
		Namespace: namespace,
		Name:      name,
	}
	existing, err := client.Get(ctx, identifier)
	if err != nil && !errorsK8s.IsNotFound(err) {
		return err
	}
	// if the source is different, do not unregister
	if existingSource, ok := existing.Annotations[PluginInstallSourceAnnotation]; ok && existingSource != source {
		return nil
	}
	return client.Delete(ctx, identifier, resource.DeleteOptions{})
}
