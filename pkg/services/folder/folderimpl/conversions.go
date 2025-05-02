package folderimpl

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/user"
)

func mapUnstructuredToFolder(item *unstructured.Unstructured, identifiers map[string]*user.User) (*folder.Folder, error) {
	meta, err := utils.MetaAccessor(item)
	if err != nil {
		return nil, err
	}

	info, _ := authlib.ParseNamespace(meta.GetNamespace())
	if info.OrgID < 0 {
		info.OrgID = 1 // This resolves all test cases that assume org 1
	}

	title, _, _ := unstructured.NestedString(item.Object, "spec", "title")
	description, _, _ := unstructured.NestedString(item.Object, "spec", "description")

	uid := meta.GetName()
	url := ""
	if uid != folder.RootFolder.UID {
		slug := slugify.Slugify(title)
		url = dashboards.GetFolderURL(uid, slug)
	}

	created := meta.GetCreationTimestamp().Local()
	updated, _ := meta.GetUpdatedTimestamp()
	if updated == nil {
		updated = &created
	} else {
		tmp := updated.Local()
		updated = &tmp
	}

	createdBy, updatedBy := int64(0), int64(0)
	createdByUID, updatedByUID := "", ""

	if len(identifiers) > 0 {
		user, ok := identifiers[meta.GetCreatedBy()]
		if ok {
			createdBy = user.ID
			createdByUID = user.UID
		}
		user, ok = identifiers[meta.GetUpdatedBy()]
		if ok {
			updatedBy = user.ID
			updatedByUID = user.UID
		}
	}

	manager, _ := meta.GetManagerProperties()
	return &folder.Folder{
		UID:         uid,
		Title:       title,
		Description: description,
		ID:          meta.GetDeprecatedInternalID(), // nolint:staticcheck
		ParentUID:   meta.GetFolder(),
		Version:     int(meta.GetGeneration()),
		ManagedBy:   manager.Kind,

		Fullpath:     meta.GetFullpath(),
		FullpathUIDs: meta.GetFullpathUIDs(),
		URL:          url,
		Created:      created,
		Updated:      *updated,
		OrgID:        info.OrgID,

		CreatedBy:    createdBy,
		CreatedByUID: createdByUID,
		UpdatedBy:    updatedBy,
		UpdatedByUID: updatedByUID,
	}, nil
}

func (ss *FolderUnifiedStoreImpl) UnstructuredToLegacyFolder(ctx context.Context, item *unstructured.Unstructured) (*folder.Folder, error) {
	meta, err := utils.MetaAccessor(item)
	if err != nil {
		return nil, err
	}

	identifiers := make(map[string]struct{}, 0)
	identifiers[meta.GetCreatedBy()] = struct{}{}
	identifiers[meta.GetUpdatedBy()] = struct{}{}

	folderUserIdentifiers, err := ss.getIdentifiersFolder(ctx, identifiers)
	if err != nil {
		return nil, err
	}

	folder, err := mapUnstructuredToFolder(item, folderUserIdentifiers)
	if err != nil {
		return nil, err
	}

	return folder, nil
}

func (ss *FolderUnifiedStoreImpl) UnstructuredToLegacyFolderList(ctx context.Context, unstructuredList *unstructured.UnstructuredList) ([]*folder.Folder, error) {
	identifiers := make(map[string]struct{}, 0)
	for _, item := range unstructuredList.Items {
		meta, err := utils.MetaAccessor(&item)
		if err != nil {
			return nil, fmt.Errorf("unable to convert unstructured item to legacy folder %w", err)
		}

		identifiers[meta.GetCreatedBy()] = struct{}{}
		identifiers[meta.GetUpdatedBy()] = struct{}{}
	}

	folderUserIdentifiers, err := ss.getIdentifiersFolder(ctx, identifiers)
	if err != nil {
		return nil, err
	}
	folders := make([]*folder.Folder, 0)
	for _, item := range unstructuredList.Items {
		folder, err := mapUnstructuredToFolder(&item, folderUserIdentifiers)
		if err != nil {
			return nil, err
		}
		folders = append(folders, folder)
	}

	return folders, nil
}

func (ss *FolderUnifiedStoreImpl) getIdentifiersFolder(ctx context.Context, identifiers map[string]struct{}) (map[string]*user.User, error) {
	identifierMap, userUIDs, userIds := separateUIDsAndIDs(identifiers)
	if len(userUIDs) == 0 && len(userIds) == 0 {
		return nil, nil
	}

	users, err := ss.userService.ListByIdOrUID(ctx, userUIDs, userIds)
	if err != nil {
		return nil, err
	}

	userMap := make(map[string]*user.User, len(users))
	for _, u := range users {
		if _, ok := identifierMap[fmt.Sprintf("user:%d", u.ID)]; ok {
			userMap[fmt.Sprintf("user:%d", u.ID)] = u
		}

		if _, ok := identifierMap[fmt.Sprintf("user:%s", u.UID)]; ok {
			userMap[fmt.Sprintf("user:%s", u.UID)] = u
		}
	}
	return userMap, nil
}

func parseIdentifier(identifier string) string {
	parts := strings.Split(identifier, ":")
	if len(parts) < 2 {
		return ""
	}
	if parts[0] != "user" {
		return ""
	}
	return parts[1]
}

func separateUIDsAndIDs(identifiers map[string]struct{}) (map[string]string, []string, []int64) {
	uids := make([]string, 0)
	ids := make([]int64, 0)
	identifierMap := make(map[string]string, 0)

	for identifier := range identifiers {
		value := parseIdentifier(identifier)
		if value == "" {
			continue
		}

		identifierMap[identifier] = value

		id, err := strconv.ParseInt(value, 10, 64)
		if err == nil {
			ids = append(ids, id)
		} else {
			uids = append(uids, value)
		}
	}

	return identifierMap, uids, ids
}
