package apistore

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"regexp"

	apiequality "k8s.io/apimachinery/pkg/api/equality"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"

	authtypes "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const (
	provisioningGroup    = "provisioning.grafana.app"
	provisioningVersion  = "v0alpha1"
	repositoriesResource = "repositories"
)

var (
	errResourceIsManagedInRepository = fmt.Errorf("this resource is managed by a repository")

	// errManagerGone reports that a write could not be routed because the repository managing the
	// resource no longer exists. Nothing was written, and there is nothing left in git to write to.
	errManagerGone = errors.New("the repository managing this resource no longer exists")

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
		return utils.NewForbiddenManagerKindChangeError(managerOld, managerNew)
	}

	// For non-Terraform managers, identity changes are also blocked.
	// Remove the old manager first, then add a new one with a different identity.
	//
	// Classic shim kinds are exempt: their identity is absent or unstable (e.g. a
	// file-provisioning reader name, or empty for API/converted-Prometheus origins),
	// so it is not a user-defined stable ID and must not be treated as immutable.
	if hasOld && managerNew.Kind != utils.ManagerKindTerraform && !managerNew.Kind.IsClassic() && managerNew.Identity != managerOld.Identity {
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
		if identity.IsProvisioningServiceIdentity(auth) {
			return nil // OK!
		}
		// This can fallback to writing the value with a provisioning client
		return errResourceIsManagedInRepository

	case utils.ManagerKindPlugin,
		utils.ManagerKindClassicFP,                  // nolint:staticcheck
		utils.ManagerKindClassicAPI,                 // nolint:staticcheck
		utils.ManagerKindClassicConvertedPrometheus: // nolint:staticcheck
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

// managedResourceCommitMessage returns the git commit message to use when
// forwarding a managed-resource write to the provisioning files endpoint. It
// prefers the caller-supplied grafana.app/message annotation and falls back to
// an action-specific message so the downstream nanogit commit always has a
// non-empty subject.
func managedResourceCommitMessage(obj utils.GrafanaMetaAccessor, action resourcepb.WatchEvent_Type) string {
	if msg := obj.GetMessage(); msg != "" {
		return msg
	}
	switch action {
	case resourcepb.WatchEvent_ADDED:
		return fmt.Sprintf("Create %s", obj.GetName())
	case resourcepb.WatchEvent_DELETED:
		return fmt.Sprintf("Delete %s", obj.GetName())
	default:
		return fmt.Sprintf("Update %s", obj.GetName())
	}
}

func (s *Storage) provisioningClient(ctx context.Context) (rest.Interface, error) {
	cfg, err := s.configProvider.GetRestConfig(ctx)
	if err != nil {
		return nil, err
	}
	cfg.NegotiatedSerializer = serializer.WithoutConversionCodecFactory{CodecFactory: scheme.Codecs}
	cfg.GroupVersion = &schema.GroupVersion{Group: provisioningGroup, Version: provisioningVersion}
	return rest.RESTClientFor(cfg)
}

// repositoryExists reports whether the named repository is still there. The lookup runs as the
// provisioning identity because a caller may be allowed to write a resource without being allowed
// to read repositories, and this is only an existence probe.
func (s *Storage) repositoryExists(ctx context.Context, namespace, name string) (bool, error) {
	if s.configProvider == nil || name == "" {
		return true, nil
	}
	ctx, _, err := identity.WithProvisioningIdentity(ctx, namespace)
	if err != nil {
		return false, err
	}
	client, err := s.provisioningClient(ctx)
	if err != nil {
		return false, err
	}
	err = client.Get().
		Namespace(namespace).
		Resource(repositoriesResource).
		Name(name).
		Do(ctx).
		Error()
	switch {
	case err == nil:
		return true, nil
	case apierrors.IsNotFound(err):
		return false, nil
	default:
		return false, err
	}
}

// isRepositoryNotFound reports whether err is the provisioning API saying the repository named in
// the request path is gone. The files endpoint also returns not-found for a missing file or ref,
// but only the repository's own not-found names the repositories resource in its details.
func isRepositoryNotFound(err error) bool {
	statusErr, ok := errors.AsType[*apierrors.StatusError](err)
	if !ok || statusErr.ErrStatus.Reason != metav1.StatusReasonNotFound {
		return false
	}
	details := statusErr.ErrStatus.Details
	return details != nil && details.Group == provisioningGroup && details.Kind == repositoriesResource
}

// managerRepositoryGone reports whether obj is managed by a repository that no longer exists.
func (s *Storage) managerRepositoryGone(ctx context.Context, obj utils.GrafanaMetaAccessor) bool {
	manager, ok := obj.GetManagerProperties()
	if !ok || manager.Kind != utils.ManagerKindRepo {
		return false
	}
	exists, err := s.repositoryExists(ctx, obj.GetNamespace(), manager.Identity)
	return err == nil && !exists
}

// isOrphanedRepositoryRootFolder reports whether obj is a repository root folder left behind by a
// repository that no longer exists. The root folder stands for the repository itself rather than a
// file, which is why it is the one repo-managed resource with no source path: there is nothing to
// route a write to, and with the repository gone nothing will re-create it either.
func (s *Storage) isOrphanedRepositoryRootFolder(ctx context.Context, obj utils.GrafanaMetaAccessor) bool {
	if src, ok := obj.GetSourceProperties(); ok && src.Path != "" {
		return false
	}
	return s.managerRepositoryGone(ctx, obj)
}

// allowOrphanedUpdate reports whether an update the managed-resource check rejected may proceed
// anyway because the repository managing the resource is gone. Two shapes qualify, and both leave
// the spec and the folder untouched: releasing the resource by dropping its manager annotations,
// and the metadata-only write that starts a delete, such as a folder's terminating label.
//
// Release is otherwise admin-only. Once the repository is gone that bar protects nothing — there is
// no repository left to own the resource — and it would be incoherent to let an authorized caller
// delete the resource outright while refusing them the lesser step of detaching it. The caller is
// still authorized to write the resource by the API layer either way.
func (s *Storage) allowOrphanedUpdate(ctx context.Context, obj, previous utils.GrafanaMetaAccessor) bool {
	if !isManagerRelease(obj, previous) && !isMetadataOnlyUpdate(obj, previous) {
		return false
	}
	return s.managerRepositoryGone(ctx, previous)
}

// isManagerRelease reports whether an update only detaches the resource from its manager. The
// source annotations go with it, so they are not compared.
func isManagerRelease(obj, previous utils.GrafanaMetaAccessor) bool {
	if _, managed := obj.GetManagerProperties(); managed {
		return false
	}
	if _, wasManaged := previous.GetManagerProperties(); !wasManaged {
		return false
	}
	return specAndFolderUnchanged(obj, previous)
}

// isMetadataOnlyUpdate reports whether an update leaves everything that belongs in git untouched.
func isMetadataOnlyUpdate(obj, previous utils.GrafanaMetaAccessor) bool {
	newManager, _ := obj.GetManagerProperties()
	oldManager, _ := previous.GetManagerProperties()
	if newManager != oldManager {
		return false
	}
	return specAndFolderUnchanged(obj, previous)
}

func specAndFolderUnchanged(obj, previous utils.GrafanaMetaAccessor) bool {
	if obj.GetFolder() != previous.GetFolder() {
		return false
	}
	spec, specErr := obj.GetSpec()
	oldSpec, oldSpecErr := previous.GetSpec()
	if specErr != nil || oldSpecErr != nil {
		return false
	}
	return apiequality.Semantic.DeepEqual(spec, oldSpec)
}

// handleManagedResourceRouting re-routes a write for a repo-managed resource to the provisioning
// files endpoint. cleanupSafe reports whether the write definitely did not persist (so a caller may
// safely delete secrets it created for it): true only when the provisioning request was never sent,
// false once it is sent because the endpoint may have committed the file even when it returns an error.
func (s *Storage) handleManagedResourceRouting(ctx context.Context,
	err error,
	action resourcepb.WatchEvent_Type,
	key string,
	orig runtime.Object,
	rsp runtime.Object,
) (cleanupSafe bool, _ error) {
	if !errors.Is(err, errResourceIsManagedInRepository) || s.configProvider == nil {
		return true, err // not routed: the write was never attempted
	}
	obj, err := utils.MetaAccessor(orig)
	if err != nil {
		return true, err
	}
	repo, ok := obj.GetManagerProperties()
	if !ok {
		return true, fmt.Errorf("expected managed resource")
	}
	if repo.Kind != utils.ManagerKindRepo {
		if !repo.AllowsEdits {
			return true, fmt.Errorf("managed resource does not allow edits")
		}
	}
	src, ok := obj.GetSourceProperties()
	if !ok || src.Path == "" {
		return true, fmt.Errorf("managed resource is missing source path annotation")
	}

	client, err := s.provisioningClient(ctx)
	if err != nil {
		return true, err
	}

	if action == resourcepb.WatchEvent_DELETED {
		// TODO? can we copy orig into rsp without a full get?
		if err = s.Get(ctx, key, storage.GetOptions{}, rsp); err != nil { // COPY?
			return true, err
		}
		result := client.Delete().
			Namespace(obj.GetNamespace()).
			Resource("repositories").
			Name(repo.Identity).
			Suffix("files", src.Path).
			Param("message", managedResourceCommitMessage(obj, action)).
			Do(ctx)
		if err := result.Error(); err != nil {
			// The repository was deleted between reading the resource and this call.
			if isRepositoryNotFound(err) {
				return true, errManagerGone
			}
			return false, err
		}
		return false, nil
	}

	var req *rest.Request
	switch action {
	case resourcepb.WatchEvent_ADDED:
		req = client.Post()
	case resourcepb.WatchEvent_MODIFIED:
		req = client.Put()
	default:
		return true, fmt.Errorf("unsupported provisioning action: %v, %w", action, err)
	}

	// Execute the change. The provisioning files endpoint reads the commit
	// message from the `message` query parameter only — it does not inspect
	// the body's grafana.app/message annotation. Forward the annotation here
	// (with a sensible fallback) so writes through this fallback path produce
	// a non-empty git commit message.
	result := req.Namespace(obj.GetNamespace()).
		Resource("repositories").
		Name(repo.Identity).
		Suffix("files", src.Path).
		Body(orig).
		Param("skipDryRun", "true").
		Param("message", managedResourceCommitMessage(obj, action)).
		Do(ctx)
	if err = result.Error(); err != nil {
		// The files endpoint may commit the repository file before returning an error
		// (e.g. a 409 after the write), so any post-send failure is ambiguous: keep the
		// secret rather than orphan a committed reference.
		return false, err
	}

	// The write persisted; keep any secrets even if the read-back fails.
	return false, s.Get(ctx, key, storage.GetOptions{}, rsp)
}
