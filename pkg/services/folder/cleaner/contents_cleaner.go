package cleaner

import (
	"context"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/folder"
)

// ContentsCleaner deletes a folder's contained resources by fanning out to the folder.RegistryService
// implementations it was constructed with — independent of the folder Service, so the cascade can
// clean up in the request path and alerting/library panels import folder, not the reverse. Which
// resources it deletes is fixed by ProvideFolderContentsDeleter (alert rules and library elements);
// dashboards are deliberately not among them, as the cascade deletes those via the apiserver client.
type ContentsCleaner struct {
	services []folder.RegistryService
}

func NewContentsCleaner(services ...folder.RegistryService) *ContentsCleaner {
	return &ContentsCleaner{services: services}
}

// DeleteInFolder deletes the contained resources in a single folder. It runs under the caller's
// context, which the cascade promotes to a service identity so it does not orphan resources the
// requesting user cannot see.
func (c *ContentsCleaner) DeleteInFolder(ctx context.Context, namespace, folderUID string) error {
	ns, err := claims.ParseNamespace(namespace)
	if err != nil {
		return err
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return err
	}

	for _, r := range c.services {
		if err := r.DeleteInFolders(ctx, ns.OrgID, []string{folderUID}, user); err != nil {
			return err
		}
	}
	return nil
}
