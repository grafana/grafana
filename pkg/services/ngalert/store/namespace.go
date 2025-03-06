package store

import (
	"context"
	"errors"
	"sort"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
)

// GetUserVisibleNamespaces returns the folders that are visible to the user
// TODO: Move this to AlertingFolderService
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
// TODO: Move this to AlertingFolderService
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

type AlertingFolderService struct {
	FolderService folder.Service
	Logger        log.Logger
}

func NewAlertingFolderService(fs folder.Service, logger log.Logger) *AlertingFolderService {
	return &AlertingFolderService{
		FolderService: fs,
		Logger:        logger,
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

// GetOrCreateNamespaceByTitle gets or creates a namespace by title in the specified folder.
func (s AlertingFolderService) GetOrCreateNamespaceByTitle(ctx context.Context, title string, orgID int64, user identity.Requester, parentUID string) (*folder.Folder, error) {
	var f *folder.Folder
	var err error

	f, err = s.GetNamespaceByTitle(ctx, title, orgID, user, parentUID)
	if err != nil && !errors.Is(err, dashboards.ErrFolderNotFound) {
		return nil, err
	}

	if f == nil {
		cmd := &folder.CreateFolderCommand{
			OrgID:        orgID,
			Title:        title,
			SignedInUser: user,
			ParentUID:    parentUID,
		}
		f, err = s.FolderService.Create(ctx, cmd)
		if err != nil {
			return nil, err
		}
	}

	return f, nil
}
