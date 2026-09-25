package setting

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/request"
)

// Writer is the write surface of the settings service, scoped to the caller's
// namespace (from ctx). It writes the "us" (override) layer only.
type Writer interface {
	Upsert(ctx context.Context, s *Setting) error
	// Delete is a no-op when the row is missing, so prune stays idempotent.
	Delete(ctx context.Context, section, key string) error
}

var _ Writer = (*remoteSettingService)(nil)

func (s *remoteSettingService) Upsert(ctx context.Context, setting *Setting) error {
	namespace, ok := request.NamespaceFrom(ctx)
	if !ok || namespace == "" {
		return fmt.Errorf("missing namespace in context")
	}

	// No name on create: the apiserver derives it from section/key.
	createBody, err := settingBody("", namespace, setting)
	if err != nil {
		return err
	}

	// POST create, then PUT on conflict: the apiserver has no server-side apply,
	// and its PUT is last-write-wins (no resourceVersion needed).
	createErr := s.restClient.Post().
		Resource(resource).
		Namespace(namespace).
		Body(createBody).
		Do(ctx).Error()
	if createErr == nil {
		return nil
	}
	if !apierrors.IsAlreadyExists(createErr) {
		return fmt.Errorf("upsert (create) setting %s/%s: %w", setting.Section, setting.Key, createErr)
	}

	// Server-assigned name; read it from the conflict.
	name := nameFromStatus(createErr)
	if name == "" {
		return fmt.Errorf("upsert (update) setting %s/%s: conflict did not carry a resource name: %w", setting.Section, setting.Key, createErr)
	}
	updateBody, err := settingBody(name, namespace, setting)
	if err != nil {
		return err
	}
	if err := s.restClient.Put().
		Resource(resource).
		Namespace(namespace).
		Name(name).
		Body(updateBody).
		Do(ctx).Error(); err != nil {
		return fmt.Errorf("upsert (update) setting %s/%s: %w", setting.Section, setting.Key, err)
	}
	return nil
}

func (s *remoteSettingService) Delete(ctx context.Context, section, key string) error {
	namespace, ok := request.NamespaceFrom(ctx)
	if !ok || namespace == "" {
		return fmt.Errorf("missing namespace in context")
	}

	// Server-assigned names, so delete by (section, key) labels (idempotent).
	selector, err := metav1.LabelSelectorAsSelector(&metav1.LabelSelector{
		MatchLabels: map[string]string{"section": section, "key": key},
	})
	if err != nil {
		return fmt.Errorf("delete setting %s/%s: %w", section, key, err)
	}
	if err := s.restClient.Delete().
		Resource(resource).
		Namespace(namespace).
		Param("labelSelector", selector.String()).
		Do(ctx).Error(); err != nil {
		return fmt.Errorf("delete setting %s/%s: %w", section, key, err)
	}
	return nil
}

// settingBody marshals a Setting; an empty name becomes generateName so the
// apiserver assigns one.
func settingBody(name, namespace string, setting *Setting) ([]byte, error) {
	metadata := map[string]any{"namespace": namespace}
	if name != "" {
		metadata["name"] = name
	} else {
		metadata["generateName"] = "true"
	}
	return json.Marshal(map[string]any{
		"apiVersion": settingGroupVersion.String(),
		"kind":       "Setting",
		"metadata":   metadata,
		"spec": map[string]any{
			"section": setting.Section,
			"key":     setting.Key,
			"value":   setting.Value,
		},
	})
}

func nameFromStatus(err error) string {
	var status apierrors.APIStatus
	if errors.As(err, &status) {
		if d := status.Status().Details; d != nil {
			return d.Name
		}
	}
	return ""
}
