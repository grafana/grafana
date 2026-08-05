package setting

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
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
	name := settingResourceName(setting.Section, setting.Key)

	body, err := json.Marshal(map[string]any{
		"apiVersion": settingGroupVersion.String(),
		"kind":       "Setting",
		"metadata": map[string]any{
			"name":      name,
			"namespace": namespace,
		},
		"spec": map[string]any{
			"section": setting.Section,
			"key":     setting.Key,
			"value":   setting.Value,
		},
	})
	if err != nil {
		return err
	}

	// POST create, then PUT on conflict: the apiserver has no server-side apply,
	// and its PUT is last-write-wins (no resourceVersion needed).
	createErr := s.restClient.Post().
		Resource(resource).
		Namespace(namespace).
		Body(body).
		Do(ctx).Error()
	if createErr == nil {
		return nil
	}
	if !apierrors.IsAlreadyExists(createErr) {
		return fmt.Errorf("upsert (create) setting %s/%s: %w", setting.Section, setting.Key, createErr)
	}

	if err := s.restClient.Put().
		Resource(resource).
		Namespace(namespace).
		Name(name).
		Body(body).
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
	name := settingResourceName(section, key)

	if err := s.restClient.Delete().
		Resource(resource).
		Namespace(namespace).
		Name(name).
		Do(ctx).Error(); err != nil && !apierrors.IsNotFound(err) {
		return fmt.Errorf("delete setting %s/%s: %w", section, key, err)
	}
	return nil
}

// settingResourceName maps a section/key pair to a deterministic, RFC1123-safe
// resource name, e.g. (auth.saml, certificate_url) -> "auth.saml--certificate-url".
// Underscores are not valid in K8s names, so they collapse to dashes.
func settingResourceName(section, key string) string {
	sanitize := func(s string) string {
		return strings.ToLower(strings.ReplaceAll(s, "_", "-"))
	}
	return sanitize(section) + "--" + sanitize(key)
}
