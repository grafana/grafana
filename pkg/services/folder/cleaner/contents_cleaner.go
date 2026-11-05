package cleaner

import (
	"context"
	"fmt"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/folder"
)

// DeleteFunc matches both the checked and Unchecked delete methods, letting ContentsCleaner serve either path.
type DeleteFunc func(ctx context.Context, orgID int64, folderUIDs []string, user identity.Requester) error

// ContentsCleaner deletes a folder's resources via the DeleteFuncs it's built with; the checked
// and Unchecked variants differ only in which method is wired.
type ContentsCleaner struct {
	deleteFuncs []DeleteFunc
	// checkRequester guards against a nil/mismatched requester; nil on the Unchecked path, whose
	// caller (cascadeDeleteStorage) has already authorized the requester via authlib.AccessClient.
	checkRequester func(user identity.Requester, namespace string) error
}

func NewContentsCleaner(services ...folder.RegistryService) *ContentsCleaner {
	deleteFuncs := make([]DeleteFunc, len(services))
	for i, s := range services {
		deleteFuncs[i] = s.DeleteInFolders
	}
	return &ContentsCleaner{
		deleteFuncs:    deleteFuncs,
		checkRequester: checkRequesterNamespace,
	}
}

// DeleteInFolder deletes a folder's contents, attributing them to user even if ctx carries a service identity.
func (c *ContentsCleaner) DeleteInFolder(ctx context.Context, namespace, folderUID string, user identity.Requester) error {
	if c.checkRequester != nil {
		if err := c.checkRequester(user, namespace); err != nil {
			return err
		}
	}

	ns, err := claims.ParseNamespace(namespace)
	if err != nil {
		return err
	}

	folderUIDs := []string{folderUID}
	for _, del := range c.deleteFuncs {
		if err := del(ctx, ns.OrgID, folderUIDs, user); err != nil {
			return err
		}
	}
	return nil
}

// checkRequesterNamespace rejects a nil requester or a namespace mismatch, using NamespaceMatches
// (not OrgID) since every "stacks-<id>" namespace maps to OrgID 1.
func checkRequesterNamespace(user identity.Requester, namespace string) error {
	if user == nil || user.IsNil() {
		return folder.ErrAccessDenied
	}
	if !user.GetIsGrafanaAdmin() && !user.IsIdentityType(claims.TypeAnonymous) && !claims.NamespaceMatches(user.GetNamespace(), namespace) {
		return fmt.Errorf("requester namespace %q does not match target namespace %q: %w", user.GetNamespace(), namespace, folder.ErrAccessDenied)
	}
	return nil
}
