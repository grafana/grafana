package resources

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	configmaprepo "github.com/grafana/grafana/apps/provisioning/pkg/repository/configmap"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

const (
	mirrorManagedByLabel = "provisioning.grafana.app/configmap-mirror"
	mirrorRepoLabel      = "provisioning.grafana.app/repository"
	mirrorUIDLabel       = "provisioning.grafana.app/dashboard-uid"
	dashboardDataKey     = "dashboard.json"
)

type configMapMirrorResources struct {
	RepositoryResources
	repo    repository.Reader
	cfg     *provisioning.Repository
	clients configmaprepo.ClientProvider
}

// MaybeWrapConfigMapMirror wraps repository resources with optional ConfigMap mirroring.
func MaybeWrapConfigMapMirror(inner RepositoryResources, repo repository.ReaderWriter, clients configmaprepo.ClientProvider) RepositoryResources {
	cfg := repo.Config()
	if cfg == nil || cfg.Spec.Sync.ConfigMapMirror == nil || !cfg.Spec.Sync.ConfigMapMirror.Enabled {
		return inner
	}
	if clients == nil {
		clients = configmaprepo.InClusterClientProvider()
	}
	return &configMapMirrorResources{
		RepositoryResources: inner,
		repo:                repo,
		cfg:                 cfg,
		clients:             clients,
	}
}

func (m *configMapMirrorResources) WriteResourceFromFile(ctx context.Context, path, ref string, opts ...WriteResourceOption) (string, schema.GroupVersionKind, error) {
	name, gvk, err := m.RepositoryResources.WriteResourceFromFile(ctx, path, ref, opts...)
	if err == nil {
		m.mirrorUpsert(ctx, path, ref, name, gvk)
	}
	return name, gvk, err
}

func (m *configMapMirrorResources) ReplaceResourceFromFile(ctx context.Context, path, ref string, oldName string, oldGVR schema.GroupVersionResource, opts ...WriteResourceOption) (string, schema.GroupVersionKind, error) {
	name, gvk, err := m.RepositoryResources.ReplaceResourceFromFile(ctx, path, ref, oldName, oldGVR, opts...)
	if err == nil {
		m.mirrorUpsert(ctx, path, ref, name, gvk)
		if oldName != "" && oldName != name && isDashboardGVK(schema.GroupVersionKind{Group: oldGVR.Group, Kind: "Dashboard"}) {
			m.mirrorDelete(ctx, oldName)
		}
	}
	return name, gvk, err
}

func (m *configMapMirrorResources) ReplaceResourceFromFileByRef(ctx context.Context, path, ref, previousRef string, opts ...WriteResourceOption) (string, schema.GroupVersionKind, error) {
	name, gvk, err := m.RepositoryResources.ReplaceResourceFromFileByRef(ctx, path, ref, previousRef, opts...)
	if err == nil {
		m.mirrorUpsert(ctx, path, ref, name, gvk)
	}
	return name, gvk, err
}

func (m *configMapMirrorResources) RemoveResourceFromFile(ctx context.Context, path, ref string) (string, string, schema.GroupVersionKind, error) {
	name, folder, gvk, err := m.RepositoryResources.RemoveResourceFromFile(ctx, path, ref)
	if err == nil && isDashboardGVK(gvk) {
		m.mirrorDelete(ctx, name)
	}
	return name, folder, gvk, err
}

func isDashboardGVK(gvk schema.GroupVersionKind) bool {
	return gvk.Group == "dashboard.grafana.app" && gvk.Kind == "Dashboard"
}

func (m *configMapMirrorResources) mirrorOpts() *provisioning.ConfigMapMirrorOptions {
	return m.cfg.Spec.Sync.ConfigMapMirror
}

func (m *configMapMirrorResources) mirrorNamespace() string {
	if ns := m.mirrorOpts().Namespace; ns != "" {
		return ns
	}
	return m.cfg.Namespace
}

func (m *configMapMirrorResources) mirrorUpsert(ctx context.Context, path, ref, name string, gvk schema.GroupVersionKind) {
	if !isDashboardGVK(gvk) || name == "" {
		return
	}
	logger := logging.FromContext(ctx)
	info, err := m.repo.Read(ctx, path, ref)
	if err != nil {
		logger.Error("configmap mirror: read file failed", "path", path, "error", err)
		return
	}
	client, err := m.clients.Kubernetes()
	if err != nil {
		logger.Error("configmap mirror: kubernetes client unavailable", "error", err)
		return
	}
	ns := m.mirrorNamespace()
	opts := m.mirrorOpts()
	cmName := m.cfg.Name
	dataKey := name + ".json"
	if opts.PerDashboard {
		cmName = fmt.Sprintf("grafana-dashboard-%s", name)
		dataKey = dashboardDataKey
	}
	labels := map[string]string{
		mirrorManagedByLabel: "true",
		mirrorRepoLabel:      m.cfg.Name,
		mirrorUIDLabel:       name,
	}
	for k, v := range opts.Labels {
		labels[k] = v
	}
	annotations := map[string]string{}
	for k, v := range opts.Annotations {
		annotations[k] = v
	}

	cmClient := client.CoreV1().ConfigMaps(ns)
	existing, err := cmClient.Get(ctx, cmName, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		cm := &corev1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{
				Name:        cmName,
				Namespace:   ns,
				Labels:      labels,
				Annotations: annotations,
			},
			Data: map[string]string{dataKey: string(info.Data)},
		}
		if err := ensureMirrorSize(cm.Data); err != nil {
			logger.Error("configmap mirror: size limit", "error", err)
			return
		}
		if _, err := cmClient.Create(ctx, cm, metav1.CreateOptions{}); err != nil {
			logger.Error("configmap mirror: create failed", "name", cmName, "error", err)
		}
		return
	}
	if err != nil {
		logger.Error("configmap mirror: get failed", "name", cmName, "error", err)
		return
	}
	if existing.Data == nil {
		existing.Data = map[string]string{}
	}
	existing.Data[dataKey] = string(info.Data)
	if existing.Labels == nil {
		existing.Labels = map[string]string{}
	}
	for k, v := range labels {
		existing.Labels[k] = v
	}
	if len(annotations) > 0 {
		if existing.Annotations == nil {
			existing.Annotations = map[string]string{}
		}
		for k, v := range annotations {
			existing.Annotations[k] = v
		}
	}
	if err := ensureMirrorSize(existing.Data); err != nil {
		logger.Error("configmap mirror: size limit", "error", err)
		return
	}
	if _, err := cmClient.Update(ctx, existing, metav1.UpdateOptions{}); err != nil {
		logger.Error("configmap mirror: update failed", "name", cmName, "error", err)
	}
}

func (m *configMapMirrorResources) mirrorDelete(ctx context.Context, name string) {
	if name == "" {
		return
	}
	logger := logging.FromContext(ctx)
	client, err := m.clients.Kubernetes()
	if err != nil {
		logger.Error("configmap mirror: kubernetes client unavailable", "error", err)
		return
	}
	ns := m.mirrorNamespace()
	opts := m.mirrorOpts()
	cmClient := client.CoreV1().ConfigMaps(ns)
	if opts.PerDashboard {
		cmName := fmt.Sprintf("grafana-dashboard-%s", name)
		if err := cmClient.Delete(ctx, cmName, metav1.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
			logger.Error("configmap mirror: delete failed", "name", cmName, "error", err)
		}
		return
	}
	cmName := m.cfg.Name
	cm, err := cmClient.Get(ctx, cmName, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		return
	}
	if err != nil {
		logger.Error("configmap mirror: get failed", "name", cmName, "error", err)
		return
	}
	key := name + ".json"
	if _, ok := cm.Data[key]; !ok {
		return
	}
	delete(cm.Data, key)
	if _, err := cmClient.Update(ctx, cm, metav1.UpdateOptions{}); err != nil {
		logger.Error("configmap mirror: prune failed", "name", cmName, "error", err)
	}
}

func ensureMirrorSize(data map[string]string) error {
	n := 0
	for k, v := range data {
		n += len(k) + len(v)
	}
	if n > configmaprepo.MaxConfigMapBytes {
		return fmt.Errorf("configmap data would be %d bytes; max allowed is %d", n, configmaprepo.MaxConfigMapBytes)
	}
	return nil
}
