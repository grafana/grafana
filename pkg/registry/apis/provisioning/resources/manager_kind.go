package resources

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// CheckResourceManagerKind reads ownership without writing, so quota-blocked
// files can report a manager-kind conflict without reserving capacity.
func (r *ResourcesManager) CheckResourceManagerKind(ctx context.Context, path, ref string) (string, schema.GroupVersionKind, int, error) {
	info, err := r.repo.Read(ctx, path, ref)
	if err != nil {
		return "", schema.GroupVersionKind{}, 0, fmt.Errorf("failed to read file: %w", err)
	}
	size := len(info.Data)
	parsed, err := r.parser.Parse(ctx, info)
	if err != nil {
		return "", schema.GroupVersionKind{}, size, fmt.Errorf("failed to parse file: %w", err)
	}
	name, gvk := parsed.Obj.GetName(), parsed.GVK
	if parsed.Client == nil {
		return name, gvk, size, fmt.Errorf("unable to find client")
	}
	ctx, _, err = identity.WithProvisioningIdentity(ctx, parsed.Obj.GetNamespace())
	if err != nil {
		return name, gvk, size, err
	}
	existing, err := parsed.Client.Get(ctx, name, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		return name, gvk, size, nil
	}
	if err != nil {
		return name, gvk, size, fmt.Errorf("get existing resource manager: %w", err)
	}
	meta, err := utils.MetaAccessor(existing)
	if err != nil {
		return name, gvk, size, fmt.Errorf("get existing resource metadata: %w", err)
	}
	current, managed := meta.GetManagerProperties()
	requested := utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: parsed.Repo.Name}
	if managed && current.Kind != requested.Kind {
		return name, gvk, size, utils.NewResourceManagerKindConflictError(current, requested)
	}
	return name, gvk, size, nil
}
