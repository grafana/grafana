package resources

import (
	"context"
	"fmt"

	authlib "github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func NewFilesAuthorizer(repo *provisioning.Repository, reader repository.Reader, access, fallback auth.AccessChecker, clients ResourceClients, folders FolderAncestorFinder, folderMetadataEnabled bool) Authorizer {
	return &ProvisioningAuthorizer{
		repo:                  repo,
		reader:                reader,
		access:                access,
		clients:               clients,
		folders:               folders,
		folderMetadataEnabled: folderMetadataEnabled,
		fallback:              fallback,
	}
}

func (a *ProvisioningAuthorizer) checkResourceInFolder(ctx context.Context, parsed *ParsedResource, req authlib.CheckRequest, folderID, dir string) error {
	err := a.access.Check(ctx, req, folderID)
	if err == nil || a.fallback == nil || !apierrors.IsForbidden(err) {
		return err
	}
	allowFallback := parsed.Existing == nil
	if allowFallback && folderID == "" && RootFolder(a.repo) == "" {
		return a.fallback.Check(ctx, req, folderID)
	}
	return a.retryInFolder(ctx, err, req, folderID, dir, allowFallback)
}

func (a *ProvisioningAuthorizer) checkInFolder(ctx context.Context, req authlib.CheckRequest, folderID, dir string) error {
	return a.retryInFolder(ctx, a.access.Check(ctx, req, folderID), req, folderID, dir, true)
}

func (a *ProvisioningAuthorizer) retryInFolder(ctx context.Context, err error, req authlib.CheckRequest, folderID, dir string, allowFallback bool) error {
	if err == nil || a.fallback == nil || folderID == "" || !apierrors.IsForbidden(err) {
		return err
	}

	exists, lookupErr := a.folderExists(ctx, folderID)
	if lookupErr != nil {
		return lookupErr
	}
	if exists {
		return err
	}

	ancestor, found, lookupErr := a.folders.FindExistingAncestor(ctx, dir, "")
	if lookupErr != nil {
		return fmt.Errorf("find existing ancestor: %w", lookupErr)
	}
	if found {
		req.Name = ""
		return a.access.Check(ctx, req, ancestor)
	}
	if RootFolder(a.repo) != "" || !allowFallback {
		return err
	}
	return a.fallback.Check(ctx, req, folderID)
}

func (a *ProvisioningAuthorizer) folderExists(ctx context.Context, folderID string) (bool, error) {
	client, _, err := a.clients.Folder(ctx)
	if err != nil {
		return false, fmt.Errorf("get folder client: %w", err)
	}

	ctx, _, err = identity.WithProvisioningIdentity(ctx, a.repo.Namespace)
	if err != nil {
		return false, err
	}

	_, err = client.Get(ctx, folderID, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("get folder %q: %w", folderID, err)
	}
	return true, nil
}
