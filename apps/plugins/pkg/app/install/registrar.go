package install

import (
	"context"
	"fmt"
	"maps"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	errorsK8s "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/metrics"
)

const (
	PluginInstallSourceAnnotation = "plugins.grafana.app/install-source"
	// AppliedDependenciesAnnotation records the dependency plugin IDs that the
	// plugin storage hooks have applied for a plugin. The hooks stamp it
	// authoritatively from plugin metadata on create/update.
	AppliedDependenciesAnnotation = "plugins.grafana.app/applied-dependencies"
	// DependencyParentsAnnotation records the plugin IDs that depend on a
	// plugin. A plugin with remaining parents must keep its API record even if
	// the install that originally created the record goes away.
	DependencyParentsAnnotation = "plugins.grafana.app/dependency-parents"
	// DependencyPluginVersion is the version assigned to plugins installed
	// solely as dependencies of other plugins.
	DependencyPluginVersion = "latest"
)

type Source = string

const (
	SourceUnknown          Source = "unknown"
	SourcePluginStore      Source = "plugin-store"
	SourceChildPlugin      Source = "child-plugin"
	SourceDependencyPlugin Source = "dependency-plugin"
)

// Registrar is an interface for registering plugin installations.
type Registrar interface {
	Register(ctx context.Context, namespace string, install *PluginInstall) error
	Unregister(ctx context.Context, namespace string, name string, source Source) error
}

type PluginInstall struct {
	ID       string
	Version  string
	URL      string
	Source   Source
	ParentID string
	// Dependencies holds the plugin IDs the plugin declares as dependencies.
	// Used to detect drift against the applied-dependencies annotation so a
	// sync can trigger the storage hooks to re-reconcile dependency records.
	Dependencies []string
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
	annotations := map[string]string{
		PluginInstallSourceAnnotation: p.Source,
	}
	if len(p.Dependencies) > 0 {
		annotations[AppliedDependenciesAnnotation] = strings.Join(p.Dependencies, ",")
	}
	return &pluginsv0alpha1.Plugin{
		ObjectMeta: metav1.ObjectMeta{
			Namespace:   namespace,
			Name:        p.ID,
			Annotations: annotations,
		},
		Spec: pluginsv0alpha1.PluginSpec{
			Id:       p.ID,
			Version:  p.Version,
			Url:      url,
			ParentId: parentID,
		},
	}
}

func (p *PluginInstall) applyTo(existing *pluginsv0alpha1.Plugin) *pluginsv0alpha1.Plugin {
	updated := existing.DeepCopy()
	updated.Name = p.ID
	updated.Spec.Id = p.ID
	updated.Spec.Version = p.Version
	if p.URL != "" {
		updated.Spec.Url = &p.URL
	} else {
		updated.Spec.Url = nil
	}
	if p.ParentID != "" {
		updated.Spec.ParentId = &p.ParentID
	} else {
		updated.Spec.ParentId = nil
	}
	if updated.Annotations == nil {
		updated.Annotations = map[string]string{}
	}
	updated.Annotations[PluginInstallSourceAnnotation] = p.Source
	// Only stamp dependencies when the install declares some: the storage
	// hooks own the annotation, and an empty client-side view must not wipe
	// what they stamped.
	if len(p.Dependencies) > 0 {
		updated.Annotations[AppliedDependenciesAnnotation] = strings.Join(p.Dependencies, ",")
	}
	return updated
}

func (p *PluginInstall) ShouldUpdate(existing *pluginsv0alpha1.Plugin) bool {
	update := p.ToPluginInstallV0Alpha1(existing.Namespace)
	if source, ok := existing.Annotations[PluginInstallSourceAnnotation]; ok && source != p.Source {
		return true
	}
	if existing.Spec.Version != update.Spec.Version {
		return true
	}
	if !equalStringPointers(existing.Spec.Url, update.Spec.Url) {
		return true
	}
	if !equalStringPointers(existing.Spec.ParentId, update.Spec.ParentId) {
		return true
	}
	// Dependency drift also warrants an update even when the spec is
	// unchanged: the update run lets the storage hooks re-stamp the
	// applied-dependencies annotation and re-reconcile dependency records.
	if !equalStringSets(p.Dependencies, parseCSVAnnotation(existing.Annotations, AppliedDependenciesAnnotation)) {
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

func equalStringSets(a, b []string) bool {
	setA := make(map[string]struct{}, len(a))
	for _, v := range a {
		setA[v] = struct{}{}
	}
	setB := make(map[string]struct{}, len(b))
	for _, v := range b {
		setB[v] = struct{}{}
	}
	return maps.Equal(setA, setB)
}

func parseCSVAnnotation(annotations map[string]string, key string) []string {
	raw := annotations[key]
	if raw == "" {
		return nil
	}
	var out []string
	for _, part := range strings.Split(raw, ",") {
		if part = strings.TrimSpace(part); part != "" {
			out = append(out, part)
		}
	}
	return out
}

func hasDependencyParents(plugin *pluginsv0alpha1.Plugin) bool {
	return len(parseCSVAnnotation(plugin.Annotations, DependencyParentsAnnotation)) > 0
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
	_, err := r.register(ctx, namespace, install)
	return err
}

// register reports whether it wrote. A concurrent conflict counts as a write
// because the caller's view of the namespace is stale.
func (r *InstallRegistrar) register(ctx context.Context, namespace string, install *PluginInstall) (bool, error) {
	start := time.Now()
	defer func() {
		metrics.RegistrationDurationSeconds.WithLabelValues("register").Observe(time.Since(start).Seconds())
	}()

	logger := r.logger.WithContext(ctx).With("requestNamespace", namespace, "pluginId", install.ID, "version", install.Version)

	client, err := r.GetClient()
	if err != nil {
		logger.Error("Failed to get plugin client", "error", err)
		metrics.RegistrationOperationsTotal.WithLabelValues("register", "error").Inc()
		return false, err
	}
	identifier := resource.Identifier{
		Namespace: namespace,
		Name:      install.ID,
	}

	existing, err := client.Get(ctx, identifier)
	if err != nil && !errorsK8s.IsNotFound(err) {
		logger.Error("Failed to get existing plugin", "error", err)
		metrics.RegistrationOperationsTotal.WithLabelValues("register", "error").Inc()
		return false, err
	}

	if existing != nil {
		if install.ShouldUpdate(existing) {
			_, err = client.Update(ctx, install.applyTo(existing), resource.UpdateOptions{ResourceVersion: existing.ResourceVersion})
			if err != nil {
				if errorsK8s.IsConflict(err) {
					// another writer changed the record, report a write so the caller re-reads
					metrics.RegistrationOperationsTotal.WithLabelValues("register", "conflict").Inc()
					return true, nil
				}
				logger.Error("Failed to update plugin", "error", err)
				metrics.RegistrationOperationsTotal.WithLabelValues("register", "error").Inc()
				return false, err
			}
			metrics.RegistrationOperationsTotal.WithLabelValues("register", "success").Inc()
			return true, nil
		}
		metrics.RegistrationOperationsTotal.WithLabelValues("register", "success").Inc()
		return false, nil
	}

	_, err = client.Create(ctx, install.ToPluginInstallV0Alpha1(namespace), resource.CreateOptions{})
	if err != nil {
		if errorsK8s.IsAlreadyExists(err) {
			// Another replica created it concurrently — desired state is achieved
			metrics.RegistrationOperationsTotal.WithLabelValues("register", "conflict").Inc()
			return true, nil
		}
		logger.Error("Failed to create plugin", "error", err)
		metrics.RegistrationOperationsTotal.WithLabelValues("register", "error").Inc()
		return false, err
	}
	metrics.RegistrationOperationsTotal.WithLabelValues("register", "success").Inc()
	return true, nil
}

// maxSyncNamespacePasses bounds SyncNamespace's passes. A namespace still
// writing after this many passes is oscillating rather than settling.
const maxSyncNamespacePasses = 5

// SyncNamespace reconciles the namespace's plugin installs from the given
// source to match desired, unregistering records not in it. In-sync records
// are skipped without a read, and because writes fire storage hooks that can
// rewrite sibling records, passes repeat against a fresh list until one
// writes nothing.
func (r *InstallRegistrar) SyncNamespace(ctx context.Context, namespace string, source Source, desired []PluginInstall) error {
	client, err := r.GetClient()
	if err != nil {
		return err
	}

	desiredIDs := make(map[string]struct{}, len(desired))
	for i := range desired {
		desiredIDs[desired[i].ID] = struct{}{}
	}

	var written []string
	for pass := 0; pass < maxSyncNamespacePasses; pass++ {
		existing, err := client.ListAll(ctx, namespace, resource.ListOptions{})
		if err != nil {
			return err
		}

		written = written[:0]

		// unregister plugins that are not installed
		for i := range existing.Items {
			record := &existing.Items[i]
			if record.Spec.Id == "" {
				continue
			}
			if _, ok := desiredIDs[record.Spec.Id]; ok {
				continue
			}
			if r.unregisterIsNoOp(record, source) {
				if pass == 0 {
					metrics.RegistrationOperationsTotal.WithLabelValues("unregister", "skipped").Inc()
				}
				continue
			}
			changed, err := r.unregister(ctx, namespace, record.Spec.Id, source)
			if err != nil {
				return err
			}
			if changed {
				written = append(written, record.Spec.Id)
			}
		}

		existingByName := make(map[string]*pluginsv0alpha1.Plugin, len(existing.Items))
		for i := range existing.Items {
			existingByName[existing.Items[i].Name] = &existing.Items[i]
		}

		// register plugins that are installed
		for i := range desired {
			d := &desired[i]
			if cached := existingByName[d.ID]; cached != nil && !d.ShouldUpdate(cached) {
				if pass == 0 {
					metrics.RegistrationOperationsTotal.WithLabelValues("register", "skipped").Inc()
				}
				continue
			}
			changed, err := r.register(ctx, namespace, d)
			if err != nil {
				return err
			}
			if changed {
				written = append(written, d.ID)
			}
		}

		if len(written) == 0 {
			return nil
		}
	}

	return fmt.Errorf("plugin install sync did not converge after %d passes, still writing: %v", maxSyncNamespacePasses, written)
}

// unregisterIsNoOp reports whether the listed record proves Unregister would
// change nothing: it is the record Unregister would read by id, and it
// belongs to a different source.
func (r *InstallRegistrar) unregisterIsNoOp(record *pluginsv0alpha1.Plugin, source Source) bool {
	if record.Name != record.Spec.Id {
		return false
	}
	existingSource, ok := record.Annotations[PluginInstallSourceAnnotation]
	return ok && existingSource != source
}

// Unregister removes a plugin install from the registry.
func (r *InstallRegistrar) Unregister(ctx context.Context, namespace string, name string, source Source) error {
	_, err := r.unregister(ctx, namespace, name, source)
	return err
}

// unregister reports whether it wrote.
func (r *InstallRegistrar) unregister(ctx context.Context, namespace string, name string, source Source) (bool, error) {
	start := time.Now()
	defer func() {
		metrics.RegistrationDurationSeconds.WithLabelValues("unregister").Observe(time.Since(start).Seconds())
	}()

	logger := r.logger.WithContext(ctx).With("requestNamespace", namespace, "pluginId", name, "source", source)

	client, err := r.GetClient()
	if err != nil {
		logger.Error("Failed to get plugin client", "error", err)
		metrics.RegistrationOperationsTotal.WithLabelValues("unregister", "error").Inc()
		return false, err
	}
	identifier := resource.Identifier{
		Namespace: namespace,
		Name:      name,
	}
	existing, err := client.Get(ctx, identifier)
	if err != nil && !errorsK8s.IsNotFound(err) {
		logger.Error("Failed to get existing plugin", "error", err)
		metrics.RegistrationOperationsTotal.WithLabelValues("unregister", "error").Inc()
		return false, err
	}
	// if the plugin doesn't exist, nothing to unregister
	if existing == nil {
		metrics.RegistrationOperationsTotal.WithLabelValues("unregister", "success").Inc()
		return false, nil
	}
	// if the source is different, do not unregister. unregisterIsNoOp relies
	// on this check running before the dependency-parents demote below.
	if existingSource, ok := existing.Annotations[PluginInstallSourceAnnotation]; ok && existingSource != source {
		metrics.RegistrationOperationsTotal.WithLabelValues("unregister", "success").Inc()
		return false, nil
	}
	// if other plugins still depend on this plugin, keep the record and hand
	// ownership back to the dependency machinery instead of deleting it, so it
	// survives until the last dependent plugin is removed
	if hasDependencyParents(existing) {
		demoted := &PluginInstall{
			ID:      name,
			Version: DependencyPluginVersion,
			Source:  SourceDependencyPlugin,
		}
		if !demoted.ShouldUpdate(existing) {
			metrics.RegistrationOperationsTotal.WithLabelValues("unregister", "success").Inc()
			return false, nil
		}
		_, err = client.Update(ctx, demoted.applyTo(existing), resource.UpdateOptions{ResourceVersion: existing.ResourceVersion})
		if err != nil {
			if errorsK8s.IsConflict(err) {
				// another writer changed the record, report a write so the caller re-reads
				metrics.RegistrationOperationsTotal.WithLabelValues("unregister", "conflict").Inc()
				return true, nil
			}
			logger.Error("Failed to demote plugin to dependency install", "error", err)
			metrics.RegistrationOperationsTotal.WithLabelValues("unregister", "error").Inc()
			return false, err
		}
		metrics.RegistrationOperationsTotal.WithLabelValues("unregister", "success").Inc()
		return true, nil
	}
	err = client.Delete(ctx, identifier, resource.DeleteOptions{})
	if err != nil {
		logger.Error("Failed to delete plugin", "error", err)
		metrics.RegistrationOperationsTotal.WithLabelValues("unregister", "error").Inc()
		return false, err
	}
	metrics.RegistrationOperationsTotal.WithLabelValues("unregister", "success").Inc()
	return true, nil
}
