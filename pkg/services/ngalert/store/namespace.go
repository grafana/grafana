package store

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"sort"
	"strconv"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
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

// GetNamespaceChildren gets namespace (folder) children (first level) by its UID.
func (st DBstore) GetNamespaceChildren(ctx context.Context, uid string, orgID int64, user identity.Requester) ([]*folder.FolderReference, error) {
	q := &folder.GetChildrenQuery{
		UID:          uid,
		OrgID:        orgID,
		SignedInUser: user,
	}
	folders, err := st.FolderService.GetChildren(ctx, q)
	if err != nil {
		return nil, err
	}

	found := make([]*folder.FolderReference, 0, len(folders))
	for _, f := range folders {
		if f.ParentUID == uid {
			found = append(found, f)
		}
	}

	return found, nil
}

// GetNamespaceByTitle gets namespace by its title in the specified folder.
func (st DBstore) GetNamespaceByTitle(ctx context.Context, title string, orgID int64, user identity.Requester, parentUID string) (*folder.FolderReference, error) {
	folders, err := st.GetNamespaceChildren(ctx, parentUID, orgID, user)
	if err != nil {
		return nil, err
	}

	foundByTitle := []*folder.FolderReference{}
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

// GetOrCreateNamespaceByTitle gets or creates a namespace by title in the specified folder.
//
// To avoid race conditions when two concurrent requests try to create the same folder,
// we create folders with a deterministic UID based on the parent UID, title, and organization ID.
func (st DBstore) GetOrCreateNamespaceByTitle(ctx context.Context, title string, orgID int64, user identity.Requester, parentUID string) (*folder.FolderReference, error) {
	if len(title) == 0 {
		return nil, fmt.Errorf("title is empty")
	}

	var f *folder.FolderReference
	var err error

	f, err = st.GetNamespaceByTitle(ctx, title, orgID, user, parentUID)
	if err != nil && !errors.Is(err, dashboards.ErrFolderNotFound) {
		return nil, err
	}

	if f == nil {
		// Generate a deterministic UID with an alerting prefix
		uid, err := generateAlertingFolderUID(title, parentUID, orgID)
		if err != nil {
			return nil, fmt.Errorf("error creating a new folder: %w", err)
		}

		cmd := &folder.CreateFolderCommand{
			UID:          uid,
			OrgID:        orgID,
			Title:        title,
			SignedInUser: user,
			ParentUID:    parentUID,
		}
		var newFolder *folder.Folder
		newFolder, err = st.FolderService.Create(ctx, cmd)
		if err != nil {
			// Handle potential race condition where another request might have created
			// the folder between our check and creation attempt
			existingFolder, lookupErr := st.GetNamespaceByTitle(ctx, title, orgID, user, parentUID)
			if lookupErr == nil {
				return existingFolder, nil
			}

			// If we couldn't find it, return errors
			return nil, fmt.Errorf("failed to get or create folder: %w", errors.Join(
				fmt.Errorf("create folder: %w", err),
				fmt.Errorf("lookup folder: %w", lookupErr),
			))
		}

		f = newFolder.ToFolderReference()
	}

	return f, nil
}

// generateAlertingFolderUID creates a deterministic UID for folders
// based on the title and parent UID to avoid race conditions when multiple
// identical folders are created concurrently
func generateAlertingFolderUID(title string, parentUID string, orgID int64) (string, error) {
	h := fnv.New64a()

	hashData := [][]byte{
		[]byte(parentUID),
		{0}, // separator
		[]byte(title),
		{0},
		[]byte(strconv.FormatInt(orgID, 10)),
	}

	// Add hashData strings to the hash with a separator between them
	for _, data := range hashData {
		_, err := h.Write(data)
		if err != nil {
			return "", err
		}
	}

	// Create a deterministic string with alerting prefix
	base36 := strconv.FormatUint(h.Sum64(), 36)
	uid := fmt.Sprintf("alerting-%s", base36)

	return uid, nil
}
