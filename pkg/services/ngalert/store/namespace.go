package store

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"sort"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
)

const (
	// folderOperationTimeout is the timeout for individual folder operations (get or create)
	// in the GetOrCreateNamespaceByTitle method. The lock timeout is longer to accommodate
	// both operations.
	folderOperationTimeout = 60 * time.Second

	// getOrCreateFolderMaxRetries is the maximum number of retries allowed when
	// trying to acquire a lock for folder creation. After this many failed attempts,
	// the operation will fail with a "max retries exceeded" error.
	getOrCreateFolderMaxRetries = 10
)

// GetUserVisibleNamespaces returns the folders that are visible to the user
func (st DBstore) GetUserVisibleNamespaces(ctx context.Context, orgID int64, user identity.Requester) (map[string]*folder.Folder, error) {
	folders, err := st.FolderService.GetFolders(ctx, folder.GetFoldersQuery{
		OrgID:        orgID,
		WithFullpath: true,
		SignedInUser: user,
	})
	if err != nil {
		return nil, err
	}

	namespaceMap := make(map[string]*folder.Folder)
	for _, f := range folders {
		namespaceMap[f.UID] = f
	}
	return namespaceMap, nil
}

// GetNamespaceByUID is a handler for retrieving a namespace by its UID. Alerting rules follow a Grafana folder-like structure which we call namespaces.
func (st DBstore) GetNamespaceByUID(ctx context.Context, uid string, orgID int64, user identity.Requester) (*folder.Folder, error) {
	f, err := st.FolderService.GetFolders(ctx, folder.GetFoldersQuery{OrgID: orgID, UIDs: []string{uid}, WithFullpath: true, SignedInUser: user})
	if err != nil {
		return nil, err
	}
	if len(f) == 0 {
		return nil, dashboards.ErrFolderAccessDenied
	}
	return f[0], nil
}

// ServerLockService defines the interface for distributed locking functionality
type ServerLockService interface {
	// LockExecuteAndReleaseWithRetries acquires a lock, executes a function, and releases the lock with retries
	LockExecuteAndReleaseWithRetries(ctx context.Context, actionName string, timeConfig serverlock.LockTimeConfig, fn func(ctx context.Context), retryOpts ...serverlock.RetryOpt) error
}

type AlertingFolderService struct {
	FolderService     folder.Service
	Logger            log.Logger
	ServerLockService ServerLockService
}

func NewAlertingFolderService(fs folder.Service, logger log.Logger, serverLockService ServerLockService) *AlertingFolderService {
	return &AlertingFolderService{
		FolderService:     fs,
		Logger:            logger,
		ServerLockService: serverLockService,
	}
}

// GetNamespaceChildren gets namespace (folder) children (first level) by its UID.
func (s AlertingFolderService) GetNamespaceChildren(ctx context.Context, uid string, orgID int64, user identity.Requester) ([]*folder.Folder, error) {
	q := &folder.GetChildrenQuery{
		UID:          uid,
		OrgID:        orgID,
		SignedInUser: user,
	}
	folders, err := s.FolderService.GetChildren(ctx, q)
	if err != nil {
		return nil, err
	}

	found := make([]*folder.Folder, 0, len(folders))
	for _, f := range folders {
		if f.ParentUID == uid {
			found = append(found, f)
		}
	}

	return found, nil
}

// GetNamespaceByTitle gets namespace by its title in the specified folder.
func (s AlertingFolderService) GetNamespaceByTitle(ctx context.Context, title string, orgID int64, user identity.Requester, parentUID string) (*folder.Folder, error) {
	folders, err := s.GetNamespaceChildren(ctx, parentUID, orgID, user)
	if err != nil {
		return nil, err
	}

	foundByTitle := []*folder.Folder{}
	for _, f := range folders {
		if f.Title == title {
			foundByTitle = append(foundByTitle, f)
		}
	}

	if len(foundByTitle) == 0 {
		return nil, dashboards.ErrFolderNotFound
	}

	// Sort by UID to return the first folder in case of multiple folders with the same title
	sort.Slice(foundByTitle, func(i, j int) bool {
		return foundByTitle[i].UID < foundByTitle[j].UID
	})

	return foundByTitle[0], nil
}

// GetOrCreateNamespaceByTitle retrieves a folder with the given title from the specified parent,
// or creates it if it doesn't exist.
//
// This method uses locking to prevent race conditions when multiple
// requests attempt to create the same folder simultaneously. The lock is based on
// the combination of parent folder UID, title, and organization ID.
func (s AlertingFolderService) GetOrCreateNamespaceByTitle(ctx context.Context, title string, orgID int64, user identity.Requester, parentUID string) (*folder.Folder, error) {
	logger := s.Logger.New("parentUID", parentUID, "title", title, "orgID", orgID)

	// Configure lock retry behavior
	// Make sure the lock timeout (MaxInterval) is enough for both operations.
	timeConfig := serverlock.LockTimeConfig{
		MaxInterval: folderOperationTimeout*2 + 10*time.Second,
		MinWait:     100 * time.Millisecond,
		MaxWait:     1 * time.Second,
	}

	var folder *folder.Folder
	var folderErr error

	retryLimiter := func(attempt int) error {
		if attempt > getOrCreateFolderMaxRetries {
			return errors.New("unable to lock: max retries exceeded")
		}
		return nil
	}

	// Execute the folder get/create operation with a lock
	lockName, err := lockName(parentUID, title, orgID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate lock name: %w", err)
	}
	logger.Debug("Acquiring lock for folder creation", "lockName", lockName)
	errLock := s.ServerLockService.LockExecuteAndReleaseWithRetries(ctx, lockName, timeConfig, func(ctx context.Context) {
		// Try to get the folder
		logger.Debug("Trying to get existing folder")
		folder, folderErr = s.getFolder(ctx, title, orgID, user, parentUID, folderOperationTimeout)
		if folder != nil {
			return
		}
		// If this is not the folder not found error, return
		if !errors.Is(folderErr, dashboards.ErrFolderNotFound) {
			return
		}

		// Folder doesn't exist, create a new one
		logger.Debug("Folder not found, creating a new one")
		folder, folderErr = s.createFolder(ctx, title, orgID, user, parentUID, folderOperationTimeout)
	}, []serverlock.RetryOpt{retryLimiter}...)

	// Handle lock acquisition failures
	if errLock != nil {
		logger.Error("Failed to acquire or execute with lock", "error", errLock)
		return nil, fmt.Errorf("failed to acquire lock: %w", errLock)
	}

	// Handle folder operation errors
	if folderErr != nil {
		return nil, folderErr
	}

	if folder == nil {
		// This should never happen if the code is correct
		logger.Error("Both error and folder are nil after GetOrCreateNamespaceByTitle execution")
		return nil, fmt.Errorf("unexpected error: could not get or create a folder")
	}

	return folder, nil
}

func (s AlertingFolderService) getFolder(ctx context.Context, title string, orgID int64, user identity.Requester, parentUID string, timeout time.Duration) (*folder.Folder, error) {
	getCtx, getCancel := context.WithTimeout(ctx, timeout)
	defer getCancel()
	return s.GetNamespaceByTitle(getCtx, title, orgID, user, parentUID)
}

func (s AlertingFolderService) createFolder(ctx context.Context, title string, orgID int64, user identity.Requester, parentUID string, timeout time.Duration) (*folder.Folder, error) {
	createCtx, createCancel := context.WithTimeout(ctx, timeout)
	defer createCancel()

	cmd := &folder.CreateFolderCommand{
		OrgID:        orgID,
		Title:        title,
		SignedInUser: user,
		ParentUID:    parentUID,
	}

	return s.FolderService.Create(createCtx, cmd)
}

func lockName(parentUID, title string, orgID int64) (string, error) {
	h := fnv.New64a()
	data := fmt.Sprintf("%s|%s|%d", parentUID, title, orgID)
	_, err := h.Write([]byte(data))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("alerting-folder-create-%x", h.Sum64()), nil
}
