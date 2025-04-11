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
)

func parseUnstructuredToLegacyFolder(item *unstructured.Unstructured) (*folder.Folder, string, string, error) {
	meta, err := utils.MetaAccessor(item)
	if err != nil {
		return nil, "", "", err
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

	created := meta.GetCreationTimestamp().UTC()
	updated, _ := meta.GetUpdatedTimestamp()
	if updated == nil {
		updated = &created
	} else {
		tmp := updated.UTC()
		updated = &tmp
	}

	creator := meta.GetCreatedBy()
	updater := meta.GetUpdatedBy()
	if updater == "" {
		updater = creator
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
	}, creator, updater, nil
}

func (ss *FolderUnifiedStoreImpl) UnstructuredToLegacyFolder(ctx context.Context, item *unstructured.Unstructured) (*folder.Folder, error) {
	folder, creatorRaw, updaterRaw, err := parseUnstructuredToLegacyFolder(item)
	if err != nil {
		return nil, err
	}

	userUIDtoIDmapping, err := ss.getUserUIDtoIDmappingFromIdentifiers(ctx, []string{creatorRaw, updaterRaw})
	if err != nil {
		return nil, err
	}

	creatorId := getIdFromMapping(creatorRaw, userUIDtoIDmapping)
	updaterId := getIdFromMapping(updaterRaw, userUIDtoIDmapping)

	if updaterId == 0 {
		updaterId = creatorId
	}

	folder.CreatedBy = creatorId
	folder.UpdatedBy = updaterId

	return folder, nil
}

func (ss *FolderUnifiedStoreImpl) UnstructuredToLegacyFolderList(ctx context.Context, unstructuredList *unstructured.UnstructuredList) ([]*folder.Folder, error) {
	folders := make([]*folder.Folder, 0)
	identifiers := make([]string, 0)
	for _, item := range unstructuredList.Items {
		meta, err := utils.MetaAccessor(&item)
		if err != nil {
			return nil, fmt.Errorf("unable to convert unstructured item to legacy folder %w", err)
		}

		identifiers = append(identifiers, meta.GetCreatedBy(), meta.GetUpdatedBy())
	}

	userUIDtoIDmapping, err := ss.getUserUIDtoIDmappingFromIdentifiers(ctx, identifiers)
	if err != nil {
		return nil, err
	}

	for _, item := range unstructuredList.Items {
		folder, creatorRaw, updaterRaw, err := parseUnstructuredToLegacyFolder(&item)
		if err != nil {
			return nil, err
		}

		creatorId := getIdFromMapping(creatorRaw, userUIDtoIDmapping)
		updaterId := getIdFromMapping(updaterRaw, userUIDtoIDmapping)

		if updaterId == 0 {
			updaterId = creatorId
		}

		folder.CreatedBy = creatorId
		folder.UpdatedBy = updaterId
		folders = append(folders, folder)
	}

	return folders, nil
}

func (ss *FolderUnifiedStoreImpl) getUserUIDtoIDmappingFromIdentifiers(ctx context.Context, rawIdentifiers []string) (map[string]int64, error) {
	userUIDs, userIds := parseIdentifiers(rawIdentifiers)
	allUsers, err := ss.userService.ListByIdOrUID(ctx, userUIDs, userIds)
	if err != nil {
		return nil, err
	}

	mapping := make(map[string]int64)
	for _, user := range allUsers {
		mapping[user.UID] = user.ID
	}

	return mapping, nil
}

func getIdentifier(rawIdentifier string) string {
	parts := strings.Split(rawIdentifier, ":")
	if len(parts) < 2 {
		return ""
	}
	if parts[0] != "user" {
		return ""
	}
	return parts[1]
}

func parseIdentifiers(rawIdentifiers []string) ([]string, []int64) {
	uids := make([]string, 0)
	ids := make([]int64, 0)
	for _, rawIdentifier := range rawIdentifiers {
		identifier := getIdentifier(rawIdentifier)
		if identifier == "" {
			continue
		}

		id, err := strconv.ParseInt(identifier, 10, 64)
		if err == nil {
			ids = append(ids, id)
		} else if identifier != "" {
			uids = append(uids, identifier)
		}
	}

	return uids, ids
}

func getIdFromMapping(rawIdentifier string, mapping map[string]int64) int64 {
	identifier := getIdentifier(rawIdentifier)
	if identifier == "" {
		return 0
	}

	id, err := strconv.ParseInt(identifier, 10, 64)
	if err == nil {
		return id
	}

	uid, ok := mapping[identifier]
	if ok {
		return uid
	}

	return 0
}
