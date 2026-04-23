package install

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	errorsK8s "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/metrics"
)

const (
	PluginInstallSourceAnnotation = "plugins.grafana.app/install-source"
	maxStatusUpdateAttempts       = 5
)

type Source = string

const (
	SourceUnknown               Source = "unknown"
	SourcePluginStore           Source = "plugin-store"
	SourceChildPluginReconciler Source = "child-plugin-reconciler"
)

// Registrar is an interface for registering plugin installations.
type Registrar interface {
	Register(ctx context.Context, namespace string, install *PluginInstall) error
	Unregister(ctx context.Context, namespace string, name string, source Source) error
	Get(ctx context.Context, namespace string, name string) (*pluginsv0alpha1.Plugin, error)
	UpdateStatus(ctx context.Context, plugin *pluginsv0alpha1.Plugin, newStatus pluginsv0alpha1.PluginStatus) error
}

type PluginInstall struct {
	ID       string
	Version  string
	URL      string
	Source   Source
	ParentID string
}

func (p *PluginInstall) ToPluginInstallV0Alpha1(namespace string) *pluginsv0alpha1.Plugin {
	var url *string = nil
	if p.URL != "" {
		url = &p.URL
	}
	var parentID *string = nil
	if p.ParentID != "" {
		parentID = &p.ParentID
	}
	return &pluginsv0alpha1.Plugin{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: namespace,
			Name:      p.ID,
			Annotations: map[string]string{
				PluginInstallSourceAnnotation: p.Source,
			},
		},
		Spec: pluginsv0alpha1.PluginSpec{
			Id:       p.ID,
			Version:  p.Version,
			Url:      url,
			ParentId: parentID,
		},
	}
}

func (p *PluginInstall) ToPatchRequest() resource.PatchRequest {
	return p.patchRequest(false)
}

func (p *PluginInstall) ToOwnedPatchRequest() resource.PatchRequest {
	return p.patchRequest(true)
}

func (p *PluginInstall) patchRequest(requireSourceMatch bool) resource.PatchRequest {
	ops := make([]resource.PatchOperation, 0, 3)
	if requireSourceMatch {
		ops = append(ops, resource.PatchOperation{
			Path:      pluginInstallSourceAnnotationPath(),
			Operation: resource.PatchOpTest,
			Value:     p.Source,
		})
	}
	ops = append(ops,
		resource.PatchOperation{
			Path:      "/spec",
			Operation: resource.PatchOpAdd,
			Value: pluginsv0alpha1.PluginSpec{
				Id:       p.ID,
				Version:  p.Version,
				Url:      stringPointer(p.URL),
				ParentId: stringPointer(p.ParentID),
			},
		},
		resource.PatchOperation{
			Path:      pluginInstallSourceAnnotationPath(),
			Operation: resource.PatchOpAdd,
			Value:     p.Source,
		},
	)

	return resource.PatchRequest{Operations: ops}
}

func (p *PluginInstall) ShouldUpdate(existing *pluginsv0alpha1.Plugin) bool {
	if source, ok := existing.Annotations[PluginInstallSourceAnnotation]; ok && source != p.Source {
		return true
	}
	return !p.MatchesSpec(existing)
}

func (p *PluginInstall) MatchesSpec(existing *pluginsv0alpha1.Plugin) bool {
	update := p.ToPluginInstallV0Alpha1(existing.Namespace)
	return existing.Spec.Version == update.Spec.Version &&
		equalStringPointers(existing.Spec.Url, update.Spec.Url) &&
		equalStringPointers(existing.Spec.ParentId, update.Spec.ParentId)
}

func stringPointer(value string) *string {
	if value == "" {
		return nil
	}
	return &value
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

func pluginInstallSourceAnnotationPath() string {
	return "/metadata/annotations/" + strings.ReplaceAll(PluginInstallSourceAnnotation, "/", "~1")
}

func pluginInstallGroupResource() schema.GroupResource {
	return schema.GroupResource{Group: pluginsv0alpha1.APIGroup, Resource: "plugininstalls"}
}

func shouldPreventModification(changeSource Source, existingSource string) bool {
	return changeSource == SourcePluginStore &&
		existingSource != "" &&
		existingSource != SourcePluginStore
}

type InstallRegistrar struct {
	clientGenerator resource.ClientGenerator
	client          *pluginsv0alpha1.PluginClient
	clientErr       error
	clientOnce      sync.Once
	logger          logging.Logger
}

func NewInstallRegistrar(logger logging.Logger, clientGenerator resource.ClientGenerator) *InstallRegistrar {
	return &InstallRegistrar{
		clientGenerator: clientGenerator,
		clientOnce:      sync.Once{},
		logger:          logger,
	}
}

func (r *InstallRegistrar) GetClient() (*pluginsv0alpha1.PluginClient, error) {
	r.clientOnce.Do(func() {
		client, err := pluginsv0alpha1.NewPluginClientFromGenerator(r.clientGenerator)
		if err != nil {
			r.clientErr = err
			r.client = nil
			return
		}
		r.client = client
	})

	return r.client, r.clientErr
}

// Register creates or updates a plugin install in the registry.
func (r *InstallRegistrar) Register(ctx context.Context, namespace string, install *PluginInstall) error {
	start := time.Now()
	defer func() {
		metrics.RegistrationDurationSeconds.WithLabelValues("register").Observe(time.Since(start).Seconds())
	}()

	logger := r.logger.WithContext(ctx).With("requestNamespace", namespace, "pluginId", install.ID, "version", install.Version)

	client, err := r.GetClient()
	if err != nil {
		logger.Error("Failed to get plugin client", "error", err)
		metrics.RegistrationOperationsTotal.WithLabelValues("register", "error").Inc()
		return err
	}
	identifier := resource.Identifier{
		Namespace: namespace,
		Name:      install.ID,
	}

	_, err = client.Create(ctx, install.ToPluginInstallV0Alpha1(namespace), resource.CreateOptions{})
	if err == nil {
		metrics.RegistrationOperationsTotal.WithLabelValues("register", "success").Inc()
		return nil
	}
	if !errorsK8s.IsAlreadyExists(err) {
		logger.Error("Failed to create plugin", "error", err)
		metrics.RegistrationOperationsTotal.WithLabelValues("register", "error").Inc()
		return err
	}

	existing, getErr := client.Get(ctx, identifier)
	if getErr != nil {
		if errorsK8s.IsNotFound(getErr) {
			_, err = client.Create(ctx, install.ToPluginInstallV0Alpha1(namespace), resource.CreateOptions{})
			if err == nil || errorsK8s.IsAlreadyExists(err) {
				metrics.RegistrationOperationsTotal.WithLabelValues("register", "success").Inc()
				return nil
			}
			logger.Error("Failed to create plugin after stale already-exists error", "error", err)
			metrics.RegistrationOperationsTotal.WithLabelValues("register", "error").Inc()
			return err
		}
		logger.Error("Failed to get existing plugin after create conflict", "error", getErr)
		metrics.RegistrationOperationsTotal.WithLabelValues("register", "error").Inc()
		return getErr
	}
	if !install.ShouldUpdate(existing) {
		metrics.RegistrationOperationsTotal.WithLabelValues("register", "success").Inc()
		return nil
	}
	if existingSource, ok := existing.Annotations[PluginInstallSourceAnnotation]; ok && shouldPreventModification(install.Source, existingSource) {
		if install.MatchesSpec(existing) {
			metrics.RegistrationOperationsTotal.WithLabelValues("register", "success").Inc()
			return nil
		}
		conflictErr := errorsK8s.NewConflict(pluginInstallGroupResource(), install.ID, fmt.Errorf("plugin install is owned by source %q", existingSource))
		logger.Error("Refused to patch plugin owned by different source", "error", conflictErr, "existingSource", existingSource)
		metrics.RegistrationOperationsTotal.WithLabelValues("register", "error").Inc()
		return conflictErr
	}

	_, err = client.Patch(ctx, identifier, install.ToOwnedPatchRequest(), resource.PatchOptions{})
	if err == nil {
		metrics.RegistrationOperationsTotal.WithLabelValues("register", "success").Inc()
		return nil
	}
	if errorsK8s.IsNotFound(err) {
		_, err = client.Create(ctx, install.ToPluginInstallV0Alpha1(namespace), resource.CreateOptions{})
		if err == nil || errorsK8s.IsAlreadyExists(err) {
			metrics.RegistrationOperationsTotal.WithLabelValues("register", "success").Inc()
			return nil
		}
	}

	existing, getErr = client.Get(ctx, identifier)
	if getErr != nil {
		if errorsK8s.IsNotFound(getErr) {
			_, err = client.Create(ctx, install.ToPluginInstallV0Alpha1(namespace), resource.CreateOptions{})
			if err == nil || errorsK8s.IsAlreadyExists(err) {
				metrics.RegistrationOperationsTotal.WithLabelValues("register", "success").Inc()
				return nil
			}
		}
		logger.Error("Failed to get existing plugin after patch failure", "error", getErr)
		metrics.RegistrationOperationsTotal.WithLabelValues("register", "error").Inc()
		return getErr
	}
	if !install.ShouldUpdate(existing) {
		metrics.RegistrationOperationsTotal.WithLabelValues("register", "success").Inc()
		return nil
	}
	if existingSource, ok := existing.Annotations[PluginInstallSourceAnnotation]; ok && shouldPreventModification(install.Source, existingSource) {
		if install.MatchesSpec(existing) {
			metrics.RegistrationOperationsTotal.WithLabelValues("register", "success").Inc()
			return nil
		}
		conflictErr := errorsK8s.NewConflict(pluginInstallGroupResource(), install.ID, fmt.Errorf("plugin install is owned by source %q", existingSource))
		logger.Error("Refused to patch plugin owned by different source", "error", conflictErr, "existingSource", existingSource)
		metrics.RegistrationOperationsTotal.WithLabelValues("register", "error").Inc()
		return conflictErr
	}

	_, err = client.Patch(ctx, identifier, install.ToPatchRequest(), resource.PatchOptions{})
	if err == nil {
		metrics.RegistrationOperationsTotal.WithLabelValues("register", "success").Inc()
		return nil
	}
	logger.Error("Failed to patch existing plugin", "error", err)
	metrics.RegistrationOperationsTotal.WithLabelValues("register", "error").Inc()
	return err
}

func (r *InstallRegistrar) Get(ctx context.Context, namespace string, name string) (*pluginsv0alpha1.Plugin, error) {
	client, err := r.GetClient()
	if err != nil {
		return nil, err
	}

	return client.Get(ctx, resource.Identifier{
		Namespace: namespace,
		Name:      name,
	})
}

// Unregister removes a plugin install from the registry.
func (r *InstallRegistrar) Unregister(ctx context.Context, namespace string, name string, source Source) error {
	start := time.Now()
	defer func() {
		metrics.RegistrationDurationSeconds.WithLabelValues("unregister").Observe(time.Since(start).Seconds())
	}()

	logger := r.logger.WithContext(ctx).With("requestNamespace", namespace, "pluginId", name, "source", source)

	client, err := r.GetClient()
	if err != nil {
		logger.Error("Failed to get plugin client", "error", err)
		metrics.RegistrationOperationsTotal.WithLabelValues("unregister", "error").Inc()
		return err
	}
	identifier := resource.Identifier{
		Namespace: namespace,
		Name:      name,
	}
	existing, err := client.Get(ctx, identifier)
	if err != nil && !errorsK8s.IsNotFound(err) {
		logger.Error("Failed to get existing plugin", "error", err)
		metrics.RegistrationOperationsTotal.WithLabelValues("unregister", "error").Inc()
		return err
	}
	// if the plugin doesn't exist, nothing to unregister
	if existing == nil {
		metrics.RegistrationOperationsTotal.WithLabelValues("unregister", "success").Inc()
		return nil
	}
	// if the source is different, do not unregister
	if existingSource, ok := existing.Annotations[PluginInstallSourceAnnotation]; ok && existingSource != source {
		metrics.RegistrationOperationsTotal.WithLabelValues("unregister", "success").Inc()
		return nil
	}
	err = client.Delete(ctx, identifier, resource.DeleteOptions{})
	if err != nil {
		logger.Error("Failed to delete plugin", "error", err)
		metrics.RegistrationOperationsTotal.WithLabelValues("unregister", "error").Inc()
		return err
	}
	metrics.RegistrationOperationsTotal.WithLabelValues("unregister", "success").Inc()
	return err
}

func (r *InstallRegistrar) UpdateStatus(ctx context.Context, plugin *pluginsv0alpha1.Plugin, newStatus pluginsv0alpha1.PluginStatus) error {
	logger := r.logger.WithContext(ctx).With("requestNamespace", plugin.Namespace, "pluginId", plugin.Name)

	client, err := r.GetClient()
	if err != nil {
		logger.Error("Failed to get plugin client for status update", "error", err)
		return err
	}

	identifier := resource.Identifier{
		Namespace: plugin.Namespace,
		Name:      plugin.Name,
	}

	current := plugin
	if current.ResourceVersion == "" {
		current, err = client.Get(ctx, identifier)
		if err != nil {
			logger.Error("Failed to get plugin before status update", "error", err)
			return err
		}
	}

	var lastErr error
	for attempt := 0; attempt < maxStatusUpdateAttempts; attempt++ {
		_, err = client.UpdateStatus(ctx, identifier, newStatus, resource.UpdateOptions{ResourceVersion: current.ResourceVersion})
		if err == nil {
			return nil
		}
		if !errorsK8s.IsConflict(err) {
			logger.Error("Failed to update plugin status", "error", err)
			return err
		}

		lastErr = err
		current, err = client.Get(ctx, identifier)
		if err != nil {
			logger.Error("Failed to refresh plugin during status update retry", "error", err)
			return err
		}
	}

	logger.Error("Failed to update plugin status after retries", "error", lastErr)
	return fmt.Errorf("update plugin status: %w", lastErr)
}
