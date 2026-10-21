package cleaner

import (
	"context"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/folder"
)

// RegistryServiceUnchecked is the Unchecked counterpart to folder.RegistryService, for stores that
// expose a folder-delete entry point without the registry service's own permission check. Satisfied
// by *rules.RuleStore and *librarypanels.LibraryPanelService.
type RegistryServiceUnchecked interface {
	DeleteInFoldersUnchecked(ctx context.Context, orgID int64, folderUIDs []string, user identity.Requester) error
}

// UncheckedContentsCleaner is ContentsCleaner's counterpart that fans out to each service's
// Unchecked delete method instead of the permission-checked one, for a deployment (e.g. a folder
// apiserver running standalone) whose cascade delete has already authorized the requester via
// authlib.AccessClient before calling in, and whose constituent stores are built without the legacy
// accesscontrol.AccessControl / dashboards.DashboardService instances the checked paths would
// otherwise need.
type UncheckedContentsCleaner struct {
	services []RegistryServiceUnchecked
}

func NewUncheckedContentsCleaner(services ...RegistryServiceUnchecked) *UncheckedContentsCleaner {
	return &UncheckedContentsCleaner{services: services}
}

// DeleteInFolder deletes the contained resources in a single folder, mirroring ContentsCleaner's
// signature so it also satisfies folders.FolderContentsDeleter.
func (c *UncheckedContentsCleaner) DeleteInFolder(ctx context.Context, namespace, folderUID string) error {
	ns, err := claims.ParseNamespace(namespace)
	if err != nil {
		return err
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return err
	}

	ctx = folder.WithUncheckedDeleteAuthorized(ctx)
	for _, r := range c.services {
		if err := r.DeleteInFoldersUnchecked(ctx, ns.OrgID, []string{folderUID}, user); err != nil {
			return err
		}
	}
	return nil
}
