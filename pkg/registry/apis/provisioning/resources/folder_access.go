package resources

import (
	"context"
	"fmt"

	authlib "github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

type folderGetter = dynamic.ResourceInterface

func NewFilesAuthorizer(repo *provisioning.Repository, reader repository.Reader, access, fallback auth.AccessChecker, clients ResourceClients, folderClient dynamic.ResourceInterface, folderMetadataEnabled bool) Authorizer {
	return &ProvisioningAuthorizer{
		repo:                  repo,
		reader:                reader,
		access:                access,
		clients:               clients,
		folderMetadataEnabled: folderMetadataEnabled,
		fallback:              fallback,
		folderClient:          folderClient,
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

	if _, lookupErr := a.getFolder(ctx, folderID); lookupErr == nil {
		return err
	} else if !apierrors.IsNotFound(lookupErr) {
		return fmt.Errorf("get folder %q: %w", folderID, lookupErr)
	}

	ancestor, found, lookupErr := a.existingAncestor(ctx, dir)
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

func (a *ProvisioningAuthorizer) existingAncestor(ctx context.Context, dir string) (string, bool, error) {
	for dir = safepath.EnsureTrailingSlash(dir); ; dir = safepath.Dir(dir) {
		folderID := RootFolder(a.repo)
		if dir != "" {
			var err error
			if folderID, err = a.getFolderID(ctx, dir); err != nil {
				return "", false, fmt.Errorf("resolve ancestor %q: %w", dir, err)
			}
		}
		if folderID == "" {
			return "", false, nil
		}

		obj, err := a.getFolder(ctx, folderID)
		if err == nil {
			if meta, metaErr := utils.MetaAccessor(obj); metaErr == nil {
				manager, _ := meta.GetManagerProperties()
				source, _ := meta.GetSourceProperties()
				if manager.Kind == utils.ManagerKindRepo && manager.Identity == a.repo.Name && safepath.EnsureTrailingSlash(source.Path) == dir {
					return folderID, true, nil
				}
			}
		} else if !apierrors.IsNotFound(err) {
			return "", false, fmt.Errorf("get ancestor folder %q: %w", folderID, err)
		}
		if dir == "" {
			return "", false, nil
		}
	}
}

func (a *ProvisioningAuthorizer) getFolder(ctx context.Context, folderID string) (metav1.Object, error) {
	ctx, _, err := identity.WithProvisioningIdentity(ctx, a.repo.Namespace)
	if err != nil {
		return nil, err
	}
	return a.folderClient.Get(ctx, folderID, metav1.GetOptions{})
}
