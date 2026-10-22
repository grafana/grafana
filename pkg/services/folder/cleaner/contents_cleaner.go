package cleaner

import (
	"context"
	"fmt"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/folder"
)

// ContentsCleaner deletes a folder's contained resources (alert rules, library elements; not
// dashboards, which the cascade deletes via the apiserver client) by fanning out to the
// folder.RegistryService implementations it was constructed with.
type ContentsCleaner struct {
	services []folder.RegistryService
}

func NewContentsCleaner(services ...folder.RegistryService) *ContentsCleaner {
	return &ContentsCleaner{services: services}
}

// DeleteInFolder deletes a folder's contents. user is the real requester and is attributed as
// such, even though ctx may carry a service identity used only for enumeration.
func (c *ContentsCleaner) DeleteInFolder(ctx context.Context, namespace, folderUID string, user identity.Requester) error {
	if user == nil || user.IsNil() {
		return folder.ErrAccessDenied
	}

	ns, err := claims.ParseNamespace(namespace)
	if err != nil {
		return err
	}

	// Guard against a caller passing a mismatched (user, namespace) pair, which would authorize
	// against the wrong org. Compared via NamespaceMatches rather than OrgID, since every
	// "stacks-<id>" namespace parses to OrgID 1 and so can't catch a cross-stack mix-up. Grafana
	// Admins and anonymous identities are exempt, mirroring the same carve-out the apiserver's own
	// namespaceAuthorizer makes (pkg/services/apiserver/auth/authorizer/namespace.go): their
	// identity's namespace is their home org, not necessarily the one they're authorized to act on.
	if !user.GetIsGrafanaAdmin() && !user.IsIdentityType(claims.TypeAnonymous) && !claims.NamespaceMatches(user.GetNamespace(), namespace) {
		return fmt.Errorf("requester namespace %q does not match target namespace %q: %w", user.GetNamespace(), namespace, folder.ErrAccessDenied)
	}

	for _, r := range c.services {
		if err := r.DeleteInFolders(ctx, ns.OrgID, []string{folderUID}, user); err != nil {
			return err
		}
	}
	return nil
}
