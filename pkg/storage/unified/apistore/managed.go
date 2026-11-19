package apistore

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"slices"

	apiequality "k8s.io/apimachinery/pkg/api/equality"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/logging"
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
	// Aliased so the routing in handleManagedResourceRouting keeps matching on it.
	errResourceIsManagedInRepository = identity.ErrResourceIsManagedInRepository
	errManagerGone                   = errors.New("the repository managing this resource no longer exists")
)

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
	cfg.GroupVersion = &schema.GroupVersion{
		Group:   provisioningGroup,
		Version: provisioningVersion,
	}
	return rest.RESTClientFor(cfg)
}

// The lookup runs as the provisioning identity because a caller may be allowed to write a resource without being allowed
// to read repositories, and this is only an existence probe.
func (s *Storage) repositoryExists(ctx context.Context, namespace, name string) (exists bool, err error) {
	if s.configProvider == nil || name == "" {
		return true, nil
	}
	ctx, _, err = identity.WithProvisioningIdentity(ctx, namespace)
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
	case isRepositoryNotFound(err, name):
		return false, nil
	default:
		return false, err
	}
}

// repositoryGoneError tells a caller that the write conflicts with the stored resource, which names a repository
// that no longer exists.
func repositoryGoneError(name string) error {
	return apierrors.NewConflict(schema.GroupResource{Group: provisioningGroup, Resource: repositoriesResource}, name, errManagerGone)
}

func isRepositoryNotFound(err error, name string) bool {
	statusErr, ok := errors.AsType[*apierrors.StatusError](err)
	if !ok || statusErr.ErrStatus.Reason != metav1.StatusReasonNotFound {
		return false
	}
	details := statusErr.ErrStatus.Details
	if details == nil ||
		details.Group != provisioningGroup ||
		details.Kind != repositoriesResource ||
		details.Name != name {
		return false
	}
	// When provisioning is disabled, the API Server returns a 404,
	// which should not count as the repository is gone
	for _, cause := range details.Causes {
		if cause.Type == metav1.CauseTypeUnexpectedServerResponse {
			return false
		}
	}
	return true
}

func (s *Storage) managerRepositoryGone(ctx context.Context, obj utils.GrafanaMetaAccessor) bool {
	manager, ok := obj.GetManagerProperties()
	if !ok || manager.Kind != utils.ManagerKindRepo {
		return false
	}
	exists, err := s.repositoryExists(ctx, obj.GetNamespace(), manager.Identity)
	if err != nil {
		// A failed lookup must not count as a deleted repository, but it must not be silent either.
		logging.FromContext(ctx).Warn("unable to check that the repository of a managed resource exists",
			"namespace", obj.GetNamespace(), "repository", manager.Identity, "err", err)
		return false
	}
	return !exists
}

// The root folder stands for the repository itself rather than a
// file so it has no source path. If there's no repository, nothing can be routed to the root folder and it is orphaned.
func (s *Storage) isOrphanedRepositoryRootFolder(ctx context.Context, obj utils.GrafanaMetaAccessor) bool {
	if src, ok := obj.GetSourceProperties(); ok && src.Path != "" {
		return false
	}
	return s.managerRepositoryGone(ctx, obj)
}

// allowOrphanedUpdateBypass allows orphan updates when:
// 1. the parent folder does not change
// AND
// 2. One of:
//   - drops the manager annotations, which releases it from the manager
//   - marks the resource for delete (i.e. with the folder terminating label), with no spec change
//
// Other updates keep the original error.
func (s *Storage) allowOrphanedUpdateBypass(ctx context.Context, obj, previous utils.GrafanaMetaAccessor) bool {
	sameFolder := obj.GetFolder() == previous.GetFolder()
	return sameFolder &&
		(isManagerRelease(obj, previous) ||
			isMarkForDeleteOnly(obj, previous)) &&
		s.managerRepositoryGone(ctx, previous)
}

func isManagerRelease(obj, previous utils.GrafanaMetaAccessor) bool {
	_, managed := obj.GetManagerProperties()
	_, wasManaged := previous.GetManagerProperties()
	_, hasManagerAnnotation := obj.GetAnnotations()[utils.AnnoKeyManagerKind]

	return !managed && wasManaged && !hasManagerAnnotation
}

// isMarkForDeleteOnly ignores the annotations that prepareObjectForUpdate sets itself. The manager
// and source annotations must not change.
func isMarkForDeleteOnly(obj, previous utils.GrafanaMetaAccessor) bool {
	if !maps.Equal(mapWithout(obj.GetLabels(), utils.LabelKeyFolderTerminating), mapWithout(previous.GetLabels(), utils.LabelKeyFolderTerminating)) {
		return false
	}
	serverAnnotations := []string{utils.AnnoKeyUpdatedBy, utils.AnnoKeyUpdatedTimestamp, utils.AnnoKeyGrantPermissions}
	if !maps.Equal(mapWithout(obj.GetAnnotations(), serverAnnotations...), mapWithout(previous.GetAnnotations(), serverAnnotations...)) {
		return false
	}
	if !finalizersUnchangedOrReleased(obj, previous) ||
		!apiequality.Semantic.DeepEqual(obj.GetOwnerReferences(), previous.GetOwnerReferences()) {
		return false
	}
	terminating := obj.GetLabels()[utils.LabelKeyFolderTerminating] == utils.LabelValueFolderTerminating
	if !terminating && obj.GetDeletionTimestamp() == nil {
		return false
	}
	return specAndFolderUnchanged(obj, previous)
}

// finalizersUnchangedOrReleased lets the owners of finalizers remove them after the delete starts.
// Kubernetes deletes the resource when the last finalizer is gone, so a delete cannot finish
// without these writes.
func finalizersUnchangedOrReleased(obj, previous utils.GrafanaMetaAccessor) bool {
	finalizers, oldFinalizers := obj.GetFinalizers(), previous.GetFinalizers()
	if slices.Equal(finalizers, oldFinalizers) {
		return true
	}
	if obj.GetDeletionTimestamp() == nil || previous.GetDeletionTimestamp() == nil {
		return false
	}
	for _, f := range finalizers {
		if !slices.Contains(oldFinalizers, f) {
			return false
		}
	}
	return true
}

func mapWithout(m map[string]string, keys ...string) map[string]string {
	m = maps.Clone(m)
	for _, key := range keys {
		delete(m, key)
	}
	return m
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
			if isRepositoryNotFound(err, repo.Identity) {
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
		if isRepositoryNotFound(err, repo.Identity) {
			return true, repositoryGoneError(repo.Identity)
		}
		// The files endpoint may commit the repository file before returning an error
		// (e.g. a 409 after the write), so any post-send failure is ambiguous: keep the
		// secret rather than orphan a committed reference.
		return false, err
	}

	// The write persisted; keep any secrets even if the read-back fails.
	return false, s.Get(ctx, key, storage.GetOptions{}, rsp)
}
