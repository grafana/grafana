package resource

import (
	"context"

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

	// The failure is swallowed, so report it or it is invisible.
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

// Allowed reports whether the caller may see an object in folder deleted by
// deletedBy.
//
// deletedBy is compared first because it needs no authorization call. The two
// conditions are ORed, so the order affects only cost, not the answer.
func (a *TrashAuthorizer) Allowed(ctx context.Context, folder, deletedBy string) bool {
	if a.namespaceMatches && deletedBy != "" && deletedBy == a.user.GetUID() {
		return true
	}
	return a.FolderAdmin(ctx, folder)
}

// FolderAdmin reports whether the caller administers folder.
//
// A kind with no folder is checked against the namespace instead, which is what
// listFromTrash has always done.
func (a *TrashAuthorizer) FolderAdmin(ctx context.Context, folder string) bool {
	if isAdmin, ok := a.folderAdmin[folder]; ok {
		return isAdmin
	}
	resp, err := a.access.Check(ctx, a.user, claims.CheckRequest{
		Verb:      utils.VerbSetPermissions,
		Group:     a.key.Group,
		Resource:  a.key.Resource,
		Namespace: a.key.Namespace,
	}, folder)
	if err != nil && a.onCheckError != nil {
		a.onCheckError(err)
	}
	isAdmin := err == nil && resp.Allowed
	a.folderAdmin[folder] = isAdmin
	return isAdmin
}
