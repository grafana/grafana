package dashboard

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apiserver/pkg/admission"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// mutateDashboardLifecycle keeps the lifecycle metadata server-owned.
//
// On create, a client may ask for a draft (lifecycle=draft); the server stamps the owner.
// Forks are created only through the fork subresource: fork metadata from a client is dropped. On update, lifecycle labels and
// annotations are carried over from the stored object whatever the client sent, so a
// regular save can neither publish a draft nor forge or drop fork metadata.
func mutateDashboardLifecycle(ctx context.Context, a admission.Attributes) error {
	obj, err := utils.MetaAccessor(a.GetObject())
	if err != nil {
		return err
	}
	switch a.GetOperation() {
	case admission.Create:
		// Server-owned metadata from a client is dropped rather than rejected, so copies of
		// a draft or fork (for example Save as) become regular dashboards.
		labels := obj.GetLabels()
		requested := labels[utils.LabelKeyLifecycle]
		delete(labels, utils.LabelKeyLifecycleOwner)
		delete(labels, utils.LabelKeyForkOf)
		annotations := obj.GetAnnotations()
		delete(annotations, utils.AnnoKeyForkBase)
		obj.SetAnnotations(annotations)
		switch requested {
		case "", utils.LifecyclePublished:
			obj.SetLabels(labels)
			return nil
		case utils.LifecycleFork:
			delete(labels, utils.LabelKeyLifecycle)
			obj.SetLabels(labels)
			return nil
		case utils.LifecycleDraft:
			if !draftsAndForksEnabled(ctx) {
				return apierrors.NewBadRequest("dashboard drafts are not enabled")
			}
			user, err := identity.GetRequester(ctx)
			if err != nil {
				return err
			}
			owner, err := lifecycleOwnerID(user)
			if err != nil {
				return err
			}
			labels[utils.LabelKeyLifecycleOwner] = owner
			obj.SetLabels(labels)
			// The creator needs access to their own draft; at the root folder that comes only
			// from the default permissions. Others still can't see it (see lifecycleGuard).
			if annotations == nil {
				annotations = map[string]string{}
			}
			if annotations[utils.AnnoKeyGrantPermissions] == "" {
				annotations[utils.AnnoKeyGrantPermissions] = utils.AnnoGrantPermissionsDefault
			}
			obj.SetAnnotations(annotations)
			return nil
		default:
			return apierrors.NewBadRequest(fmt.Sprintf("unknown %s value %q", utils.LabelKeyLifecycle, requested))
		}

	case admission.Update:
		if a.GetOldObject() == nil {
			return nil
		}
		old, err := utils.MetaAccessor(a.GetOldObject())
		if err != nil {
			return fmt.Errorf("reading stored dashboard: %w", err)
		}
		labels := obj.GetLabels()
		if labels == nil {
			labels = map[string]string{}
		}
		oldLabels := old.GetLabels()
		for _, key := range serverOwnedLifecycleLabels {
			if v, ok := oldLabels[key]; ok {
				labels[key] = v
			} else {
				delete(labels, key)
			}
		}
		obj.SetLabels(labels)
		annotations := obj.GetAnnotations()
		if annotations == nil {
			annotations = map[string]string{}
		}
		oldAnnotations := old.GetAnnotations()
		for _, key := range serverOwnedLifecycleAnnotations {
			if v, ok := oldAnnotations[key]; ok {
				annotations[key] = v
			} else {
				delete(annotations, key)
			}
		}
		obj.SetAnnotations(annotations)
	}
	return nil
}
