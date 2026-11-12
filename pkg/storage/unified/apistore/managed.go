package apistore

import (
	"context"
	"errors"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Aliased so the routing in handleManagedResourceRouting keeps matching on it.
var errResourceIsManagedInRepository = utils.ErrResourceIsManagedInRepository

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

	cfg, err := s.configProvider.GetRestConfig(ctx)
	if err != nil {
		return true, err
	}
	cfg.NegotiatedSerializer = serializer.WithoutConversionCodecFactory{CodecFactory: scheme.Codecs}
	cfg.GroupVersion = &schema.GroupVersion{
		Group:   "provisioning.grafana.app",
		Version: "v0alpha1",
	}
	client, err := rest.RESTClientFor(cfg)
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
		return false, result.Error()
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
