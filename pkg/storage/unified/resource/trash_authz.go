package resource

import (
	"context"
	"fmt"
	"slices"
	"strconv"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// TrashAuthorizer decides who may see a deleted object: whoever deleted it, or an
// admin of the folder it was in.
//
// Not the read check live search applies. Read access to a folder is common, so
// reusing it would disclose other people's deleted objects.
//
// One authorizer per request, because of the cache below.
type TrashAuthorizer struct {
	access claims.AccessClient
	user   claims.AuthInfo

	// Trash never federates, so one group and resource covers every candidate.
	key *resourcepb.ResourceKey

	// A UID only identifies someone within their own namespace.
	namespaceMatches bool

	// Cached because the check is a network call and a page of results usually
	// spans far fewer folders than items. Must not outlive the request, or a
	// permission change would never take effect.
	folderAdmin map[string]bool

	onCheckError func(err error)
}

func NewTrashAuthorizer(
	access claims.AccessClient,
	user claims.AuthInfo,
	key *resourcepb.ResourceKey,
	onCheckError func(err error),
) *TrashAuthorizer {
	return &TrashAuthorizer{
		access:           access,
		user:             user,
		key:              key,
		namespaceMatches: claims.NamespaceMatches(user.GetNamespace(), key.Namespace),
		folderAdmin:      map[string]bool{},
		onCheckError:     onCheckError,
	}
}

func (s *server) newTrashAuthorizer(ctx context.Context, user claims.AuthInfo, key *resourcepb.ResourceKey) *TrashAuthorizer {
	return NewTrashAuthorizer(s.access, user, key, func(err error) {
		s.log.FromContext(ctx).Error("Trash folder admin check failed", "error", err,
			"namespace", key.Namespace, "group", key.Group, "resource", key.Resource)
	})
}

// k6FolderUID is hidden from anyone but a service account. The single check in
// authlib denies it outright, and BatchCheck has no such rule, so batching a
// decision for it would answer differently from every other path.
//
// Spelled here rather than imported from pkg/services/accesscontrol, which unified
// storage does not depend on.
const k6FolderUID = "k6-app"

// TrashItem is one object Prepare may need a folder check for.
type TrashItem struct {
	Folder    string
	DeletedBy string
}

// Prepare resolves the folder checks items will need in one call per batch, so the
// Allowed calls that follow read the cache instead of waiting for a round trip each.
//
// A folder excluded from batching is checked on its own by FolderAdmin.
func (a *TrashAuthorizer) Prepare(ctx context.Context, items []TrashItem) error {
	var pending []string
	seen := make(map[string]bool, len(items))
	for _, item := range items {
		if a.deletedByCaller(item.DeletedBy) || seen[item.Folder] || item.Folder == k6FolderUID {
			continue
		}
		if _, decided := a.folderAdmin[item.Folder]; decided {
			continue
		}
		seen[item.Folder] = true
		pending = append(pending, item.Folder)
	}

	for batch := range slices.Chunk(pending, claims.MaxBatchCheckItems) {
		if err := a.prepareBatch(ctx, batch); err != nil {
			return err
		}
	}
	return nil
}

func (a *TrashAuthorizer) prepareBatch(ctx context.Context, folders []string) error {
	checks := make([]claims.BatchCheckItem, 0, len(folders))
	for i, folder := range folders {
		checks = append(checks, claims.BatchCheckItem{
			CorrelationID: strconv.Itoa(i),
			Verb:          utils.VerbSetPermissions,
			Group:         a.key.Group,
			Resource:      a.key.Resource,
			Folder:        folder,
		})
	}

	resp, err := a.access.BatchCheck(ctx, a.user, claims.BatchCheckRequest{
		Namespace: a.key.Namespace,
		Checks:    checks,
	})
	if err != nil {
		if a.onCheckError != nil {
			a.onCheckError(err)
		}
		return err
	}

	for i, folder := range folders {
		result, ok := resp.Results[strconv.Itoa(i)]
		if !ok {
			return fmt.Errorf("missing folder admin authorization result for %s", folder)
		}
		if result.Error != nil {
			return result.Error
		}
		a.folderAdmin[folder] = result.Allowed
	}
	return nil
}

// Allowed reports whether the caller may see an object in folder deleted by
// deletedBy.
//
// deletedBy is compared first because it needs no authorization call. The two
// conditions are ORed, so the order affects only cost, not the answer.
func (a *TrashAuthorizer) Allowed(ctx context.Context, folder, deletedBy string) (bool, error) {
	if a.deletedByCaller(deletedBy) {
		return true, nil
	}
	return a.FolderAdmin(ctx, folder)
}

func (a *TrashAuthorizer) deletedByCaller(deletedBy string) bool {
	return a.namespaceMatches && deletedBy != "" && deletedBy == a.user.GetUID()
}

// FolderAdmin reports whether the caller administers folder.
//
// A kind with no folder is checked against the namespace instead, which is what
// listFromTrash has always done.
func (a *TrashAuthorizer) FolderAdmin(ctx context.Context, folder string) (bool, error) {
	if isAdmin, ok := a.folderAdmin[folder]; ok {
		return isAdmin, nil
	}
	resp, err := a.access.Check(ctx, a.user, claims.CheckRequest{
		Verb:      utils.VerbSetPermissions,
		Group:     a.key.Group,
		Resource:  a.key.Resource,
		Namespace: a.key.Namespace,
	}, folder)
	if err != nil {
		if a.onCheckError != nil {
			a.onCheckError(err)
		}
		return false, err
	}
	a.folderAdmin[folder] = resp.Allowed
	return resp.Allowed, nil
}
