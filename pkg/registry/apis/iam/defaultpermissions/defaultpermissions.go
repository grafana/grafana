// Package defaultpermissions provides a single, reusable
// [apistore.DefaultPermissionSetter] that resource builders configure
// (via [apistore.StorageOptions.Permissions]) instead of each reimplementing
// the same Get/merge/Create-or-Update dance against the ResourcePermission
// API. Dashboards and Folders are the first adopters; any other
// folder-enabled kind can opt in with a [Config].
package defaultpermissions

import (
	"context"
	"fmt"

	authlib "github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Permission is one entry of a ResourcePermission's spec.permissions list,
// e.g. {"kind": "BasicRole", "name": "Editor", "verb": "edit"}.
type Permission = map[string]any

// ClientGetter resolves the dynamic client used to read/write ResourcePermission
// objects. Returning a nil client (with a nil error) is a valid "not configured"
// signal -- the setter becomes a no-op, matching embedded mode with the
// ResourcePermission API disabled.
type ClientGetter func(ctx context.Context) (*dynamic.NamespaceableResourceInterface, error)

// Config describes how to grant default permissions for one resource kind.
type Config struct {
	// GVR identifies the kind the ResourcePermission object refers to.
	GVR schema.GroupVersionResource

	// Client resolves the ResourcePermission dynamic client.
	Client ClientGetter

	// BuildDefaults returns the permission list a newly-created root resource
	// of this kind should have, given the identity that created it (the
	// creator is typically granted admin, in addition to fixed basic-role
	// defaults; non-user/service-account identities get only the latter).
	BuildDefaults func(creator authlib.AuthInfo) []Permission
}

// NewSetter builds an [apistore.DefaultPermissionSetter] from cfg. The returned
// function fetches any existing ResourcePermission object for the target resource
// and adds only the default entries that aren't already present (matched by
// kind+name, i.e. by subject) -- it never removes or replaces an existing entry,
// so it is safe to call repeatedly and safe to call on a resource that already
// has custom permissions.
func NewSetter(cfg Config) apistore.DefaultPermissionSetter {
	return func(ctx context.Context, _ *resourcepb.ResourceKey, id authlib.AuthInfo, obj utils.GrafanaMetaAccessor) error {
		client, err := cfg.Client(ctx)
		if err != nil {
			return err
		}
		if client == nil {
			return nil
		}

		log := logging.FromContext(ctx)
		log.Debug("setting default permissions", "resource", cfg.GVR.Resource, "uid", obj.GetName(), "namespace", obj.GetNamespace())

		// Setting the default permissions is a system operation triggered by the creation
		// (or move-to-root) of the resource, not an action the requester performs directly.
		// The actor does not yet have permission to manage permissions on the resource, so
		// this runs as a service identity against the ResourcePermission API.
		nsInfo, err := authlib.ParseNamespace(obj.GetNamespace())
		if err != nil {
			return fmt.Errorf("parse namespace: %w", err)
		}
		ctx = identity.WithServiceIdentityContext(ctx, nsInfo.OrgID)

		defaults := cfg.BuildDefaults(id)
		ns := (*client).Namespace(obj.GetNamespace())
		name := fmt.Sprintf("%s-%s-%s", cfg.GVR.Group, cfg.GVR.Resource, obj.GetName())

		existing, err := ns.Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			if !apierrors.IsNotFound(err) {
				return fmt.Errorf("get default permissions: %w", err)
			}
			if _, err := ns.Create(ctx, newResourcePermission(cfg.GVR, obj.GetName(), obj.GetNamespace(), name, defaults), metav1.CreateOptions{}); err != nil {
				log.Error("failed to create default permissions", "error", err)
				return fmt.Errorf("create default permissions: %w", err)
			}
			return nil
		}

		merged := mergePermissions(existing, defaults)
		if _, err := ns.Update(ctx, newResourcePermission(cfg.GVR, obj.GetName(), obj.GetNamespace(), name, merged), metav1.UpdateOptions{}); err != nil {
			log.Error("failed to update default permissions", "error", err)
			return fmt.Errorf("update default permissions: %w", err)
		}
		return nil
	}
}

func newResourcePermission(gvr schema.GroupVersionResource, resourceName, namespace, name string, permissions []Permission) *unstructured.Unstructured {
	return &unstructured.Unstructured{
		Object: map[string]any{
			"metadata": map[string]any{
				"name":      name,
				"namespace": namespace,
			},
			"spec": map[string]any{
				"resource": map[string]any{
					"apiGroup": gvr.Group,
					"resource": gvr.Resource,
					"name":     resourceName,
				},
				// unstructured content must be plain JSON types: []any of map[string]any,
				// not the named []Permission slice, or client-go's object tracker (used by
				// both the fake dynamic client in tests and anything else that DeepCopies
				// through runtime.DeepCopyJSON) panics on the unrecognized slice type.
				"permissions": toUnstructuredSlice(permissions),
			},
		},
	}
}

func toUnstructuredSlice(permissions []Permission) []any {
	out := make([]any, len(permissions))
	for i, p := range permissions {
		out[i] = p
	}
	return out
}

// mergePermissions returns the union of existing's current permissions and defaults,
// skipping any default entry whose subject (kind+name) already has a grant in existing
// -- so an existing grant is never duplicated or downgraded by a default for the same
// subject, and anything not in defaults is carried over untouched.
func mergePermissions(existing *unstructured.Unstructured, defaults []Permission) []Permission {
	have := map[[2]string]bool{}
	current, _, _ := unstructured.NestedSlice(existing.Object, "spec", "permissions")
	for _, p := range current {
		entry, ok := p.(map[string]any)
		if !ok {
			continue
		}
		kind, _ := entry["kind"].(string)
		name, _ := entry["name"].(string)
		have[[2]string{kind, name}] = true
	}

	merged := make([]Permission, 0, len(current)+len(defaults))
	for _, p := range current {
		if entry, ok := p.(map[string]any); ok {
			merged = append(merged, entry)
		}
	}
	for _, d := range defaults {
		kind, _ := d["kind"].(string)
		name, _ := d["name"].(string)
		if have[[2]string{kind, name}] {
			continue
		}
		merged = append(merged, d)
	}
	return merged
}
