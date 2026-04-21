package apistore

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"slices"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"

	authtypes "github.com/grafana/authlib/types"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var (
	errResourceIsManagedInRepository = fmt.Errorf("this resource is managed by a repository")

	// terraformUserAgentPattern matches the User-Agent based manager ID format used by Terraform providers.
	// Format: "Terraform/{version} (+https://www.terraform.io) terraform-provider-{name}/{version}"
	// Example: "Terraform/1.5.0 (+https://www.terraform.io) terraform-provider-grafana/v3.0.0"
	terraformUserAgentPattern = regexp.MustCompile(`^Terraform/[^ ]+ \(\+https://www\.terraform\.io\) terraform-provider-[^/]+/.+$`)
)

// isTerraformUserAgentID checks if a Terraform manager identity uses the
// DEPRECATED User-Agent based format (e.g., "Terraform/1.5.0 (+https://www.terraform.io) terraform-provider-grafana/v3.0.0").
// Modern approach uses stable custom IDs like "grafana-terraform-provider" or "my-terraform-provider".
//
// HACK: This is a workaround to allow migration from User-Agent based manager IDs to stable custom IDs.
// The Terraform provider historically used the HTTP User-Agent header as the manager identity, which:
//   - Changes with every Terraform/provider version update
//   - Was never intended to be a stable identifier
//   - Cannot be customized by users
//
// This function enables one-way migration to user-defined stable IDs by detecting the User-Agent
// format and blocking reversion back to it. This special-casing for Terraform violates the general
// principle that manager identities should be immutable, but is necessary to fix the original
// design mistake of using User-Agent as an identifier.
//
// Reference: https://github.com/grafana/terraform-provider-grafana/blob/main/pkg/provider/framework_provider.go#L307
// Format: "Terraform/{version} (+https://www.terraform.io) terraform-provider-{name}/{version}"
func isTerraformUserAgentID(identity string) bool {
	// Use regex to precisely validate the User-Agent format structure
	return terraformUserAgentPattern.MatchString(identity)
}

func checkManagerPropertiesOnDelete(auth authtypes.AuthInfo, obj utils.GrafanaMetaAccessor) error {
	return enforceManagerProperties(auth, obj)
}

func checkManagerPropertiesOnCreate(auth authtypes.AuthInfo, obj utils.GrafanaMetaAccessor) error {
	return enforceManagerProperties(auth, obj)
}

func checkManagerPropertiesOnUpdateSpec(auth authtypes.AuthInfo, obj utils.GrafanaMetaAccessor, old utils.GrafanaMetaAccessor) error {
	managerNew, hasNew := obj.GetManagerProperties()
	managerOld, hasOld := old.GetManagerProperties()

	if !hasNew && !hasOld {
		return nil // neither old nor new are managed
	}

	// Removing a manager: the caller must be authorized for the *old* manager.
	if !hasNew && hasOld {
		if err := enforceManagerProperties(auth, old); err != nil {
			// Allow admins to release repo-managed resources. There is no
			// reconciliation loop that automatically releases orphaned
			// resources, so admins need the ability to detach manually.
			if errors.Is(err, errResourceIsManagedInRepository) {
				if requester, ok := auth.(identity.Requester); ok &&
					(requester.GetIsGrafanaAdmin() || requester.HasRole(identity.RoleAdmin)) {
					return nil
				}
			}
			return &apierrors.StatusError{ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusForbidden,
				Reason:  metav1.StatusReasonForbidden,
				Message: "Can not remove resource manager from resource",
			}}
		}
		return nil
	}

	// Changing the manager kind is not allowed.
	// Remove the old manager first, then add a new one with a different kind.
	if hasOld && managerNew.Kind != managerOld.Kind {
		return &apierrors.StatusError{ErrStatus: metav1.Status{
			Status:  metav1.StatusFailure,
			Code:    http.StatusForbidden,
			Reason:  metav1.StatusReasonForbidden,
			Message: "Cannot change resource manager kind; remove the existing manager first, then add the new one",
		}}
	}

	// For non-Terraform managers, identity changes are also blocked.
	// Remove the old manager first, then add a new one with a different identity.
	if hasOld && managerNew.Kind != utils.ManagerKindTerraform && managerNew.Identity != managerOld.Identity {
		return &apierrors.StatusError{ErrStatus: metav1.Status{
			Status:  metav1.StatusFailure,
			Code:    http.StatusForbidden,
			Reason:  metav1.StatusReasonForbidden,
			Message: "Cannot change resource manager identity; remove the existing manager first, then add the new one",
		}}
	}

	// HACK: Terraform managers get special treatment for identity changes.
	// See isTerraformUserAgentID() for full explanation of why this exists.
	//
	// We allow one-way migration from deprecated User-Agent based IDs to stable custom IDs.
	// Once migrated to a custom ID, that identity is locked (cannot be changed).
	// User-Agent IDs can still be updated to other User-Agent IDs (for version updates).
	if hasOld && managerNew.Kind == utils.ManagerKindTerraform && managerNew.Identity != managerOld.Identity {
		oldIsUserAgent := isTerraformUserAgentID(managerOld.Identity)
		newIsUserAgent := isTerraformUserAgentID(managerNew.Identity)

		// Block: custom ID → User-Agent (reverting to deprecated format)
		if !oldIsUserAgent && newIsUserAgent {
			return &apierrors.StatusError{ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusForbidden,
				Reason:  metav1.StatusReasonForbidden,
				Message: "Cannot change Terraform manager ID back to User-Agent format; stable custom IDs are immutable",
			}}
		}

		// Block: custom ID → different custom ID (identity is locked after migration)
		if !oldIsUserAgent && !newIsUserAgent {
			return &apierrors.StatusError{ErrStatus: metav1.Status{
				Status:  metav1.StatusFailure,
				Code:    http.StatusForbidden,
				Reason:  metav1.StatusReasonForbidden,
				Message: "Cannot change Terraform manager ID; stable custom IDs are immutable",
			}}
		}
	}

	// Adding a manager or updating flags on the same owner.
	return enforceManagerProperties(auth, obj)
}

func ensureSameRepoManager(folder utils.GrafanaMetaAccessor, resource utils.GrafanaMetaAccessor) error {
	folderManager, ok := folder.GetManagerProperties()
	if !ok || folderManager.Kind != utils.ManagerKindRepo {
		return nil
	}

	resourceManager, resourceManaged := resource.GetManagerProperties()
	if !resourceManaged {
		return &apierrors.StatusError{ErrStatus: metav1.Status{
			Status:  metav1.StatusFailure,
			Code:    http.StatusForbidden,
			Reason:  metav1.StatusReasonForbidden,
			Message: fmt.Sprintf("folder is managed by %s:%s, but the resource is not managed", folderManager.Kind, folderManager.Identity),
		}}
	}

	if resourceManager.Kind != folderManager.Kind || resourceManager.Identity != folderManager.Identity {
		return &apierrors.StatusError{ErrStatus: metav1.Status{
			Status: metav1.StatusFailure,
			Code:   http.StatusForbidden,
			Reason: metav1.StatusReasonForbidden,
			Message: fmt.Sprintf("resource manager (%s:%s) does not match folder manager (%s:%s); resources must be managed by the same manager as their containing folder",
				resourceManager.Kind, resourceManager.Identity,
				folderManager.Kind, folderManager.Identity),
		}}
	}

	return nil
}

func enforceManagerProperties(auth authtypes.AuthInfo, obj utils.GrafanaMetaAccessor) error {
	kind := obj.GetAnnotation(utils.AnnoKeyManagerKind)
	if kind == "" {
		return nil
	}

	switch utils.ParseManagerKindString(kind) {
	case utils.ManagerKindUnknown:
		return nil // not managed

	case utils.ManagerKindRepo:
		if auth.GetUID() == "access-policy:provisioning" || slices.Contains(auth.GetAudience(), provisioning.GROUP) {
			return nil // OK!
		}
		// This can fallback to writing the value with a provisioning client
		return errResourceIsManagedInRepository

	case utils.ManagerKindPlugin, utils.ManagerKindClassicFP: // nolint:staticcheck
		// ?? what identity do we use for legacy internal requests?
		return nil // no error

	case utils.ManagerKindTerraform, utils.ManagerKindKubectl:
		manager, _ := obj.GetManagerProperties()
		if manager.AllowsEdits {
			return nil // no error anyone can do it
		}
		// TODO: check the kubectl+terraform resource
		return nil

	case utils.ManagerKindGrafana:
		// Used for global role management.
		return nil // Let the api admission hooks handle it
	}
	return nil
}

func (s *Storage) handleManagedResourceRouting(ctx context.Context,
	err error,
	action resourcepb.WatchEvent_Type,
	key string,
	orig runtime.Object,
	rsp runtime.Object,
) error {
	if !errors.Is(err, errResourceIsManagedInRepository) || s.configProvider == nil {
		return err
	}
	obj, err := utils.MetaAccessor(orig)
	if err != nil {
		return err
	}
	repo, ok := obj.GetManagerProperties()
	if !ok {
		return fmt.Errorf("expected managed resource")
	}
	if repo.Kind != utils.ManagerKindRepo {
		if !repo.AllowsEdits {
			return fmt.Errorf("managed resource does not allow edits")
		}
	}
	src, ok := obj.GetSourceProperties()
	if !ok || src.Path == "" {
		return fmt.Errorf("managed resource is missing source path annotation")
	}

	cfg, err := s.configProvider.GetRestConfig(ctx)
	if err != nil {
		return err
	}
	cfg.NegotiatedSerializer = serializer.WithoutConversionCodecFactory{CodecFactory: scheme.Codecs}
	cfg.GroupVersion = &schema.GroupVersion{
		Group:   "provisioning.grafana.app",
		Version: "v0alpha1",
	}
	client, err := rest.RESTClientFor(cfg)
	if err != nil {
		return err
	}

	if action == resourcepb.WatchEvent_DELETED {
		// TODO? can we copy orig into rsp without a full get?
		if err = s.Get(ctx, key, storage.GetOptions{}, rsp); err != nil { // COPY?
			return err
		}
		result := client.Delete().
			Namespace(obj.GetNamespace()).
			Resource("repositories").
			Name(repo.Identity).
			Suffix("files", src.Path).
			Do(ctx)
		return result.Error()
	}

	var req *rest.Request
	switch action {
	case resourcepb.WatchEvent_ADDED:
		req = client.Post()
	case resourcepb.WatchEvent_MODIFIED:
		req = client.Put()
	default:
		return fmt.Errorf("unsupported provisioning action: %v, %w", action, err)
	}

	// Execute the change
	result := req.Namespace(obj.GetNamespace()).
		Resource("repositories").
		Name(repo.Identity).
		Suffix("files", src.Path).
		Body(orig).
		Param("skipDryRun", "true").
		Do(ctx)
	err = result.Error()
	if err != nil {
		return err
	}

	// return the updated value
	return s.Get(ctx, key, storage.GetOptions{}, rsp)
}
