package folderimpl

import (
	"context"
	"errors"
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

	created := meta.GetCreationTimestamp().Time.UTC()
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

	creator, err := ss.getUserFromMeta(ctx, creatorRaw)
	if err != nil {
		return nil, err
	}

	updater, err := ss.getUserFromMeta(ctx, updaterRaw)
	if err != nil {
		return nil, err
	}
	if updater.UID == "" {
		updater = creator
	}

	folder.CreatedBy = creator.ID
	folder.UpdatedBy = updater.ID

	return folder, nil
}

func (ss *FolderUnifiedStoreImpl) UnstructuredToLegacyFolderList(ctx context.Context, unstructuredList *unstructured.UnstructuredList) ([]*folder.Folder, error) {
	folders := make([]*folder.Folder, 0)
	userIds := make([]int64, 0)
	userUIDs := make([]string, 0)
	for _, item := range unstructuredList.Items {
		meta, err := utils.MetaAccessor(&item)
		if err != nil {
			return nil, fmt.Errorf("unable to convert unstructured item to legacy folder %w", err)
		}

		creator := toUID(meta.GetCreatedBy())
		id, err := strconv.ParseInt(creator, 10, 64)
		if err == nil {
			userIds = append(userIds, id)
		} else if creator != "" {
			userUIDs = append(userUIDs, creator)
		}

		updater := toUID(meta.GetCreatedBy())
		id, err = strconv.ParseInt(updater, 10, 64)
		if err == nil {
			userIds = append(userIds, id)
		} else if updater != "" {
			userUIDs = append(userUIDs, updater)
		}
	}

	allUsers, err := ss.userService.ListByIdOrUID(ctx, userUIDs, userIds)
	if err != nil {
		return nil, err
	}

	userUIDtoIDmapping := make(map[string]int64)
	for _, user := range allUsers {
		userUIDtoIDmapping[user.UID] = user.ID
	}

	for _, item := range unstructuredList.Items {
		folder, creatorRaw, updaterRaw, err := parseUnstructuredToLegacyFolder(&item)
		if err != nil {
			return nil, err
		}

		var creatorId int64
		creatorIdentifier := toUID(creatorRaw)
		id, err := strconv.ParseInt(creatorIdentifier, 10, 64)
		if err == nil {
			creatorId = id
		} else {
			creatorId = userUIDtoIDmapping[creatorIdentifier]
		}

		var updaterId int64
		updaterIdentifier := toUID(updaterRaw)
		id, err = strconv.ParseInt(updaterIdentifier, 10, 64)
		if err == nil {
			updaterId = id
		} else {
			updaterId = userUIDtoIDmapping[updaterIdentifier]
		}

		if updaterId == 0 {
			updaterId = creatorId
		}

		folder.CreatedBy = creatorId
		folder.UpdatedBy = updaterId
		folders = append(folders, folder)
	}

	return folders, nil
}

func (ss *FolderUnifiedStoreImpl) getUserFromMeta(ctx context.Context, userMeta string) (*user.User, error) {
	if userMeta == "" || toUID(userMeta) == "" {
		return &user.User{}, nil
	}
	usr, err := ss.getUser(ctx, toUID(userMeta))
	if err != nil && errors.Is(err, user.ErrUserNotFound) {
		return &user.User{}, nil
	}
	return usr, err
}

func (ss *FolderUnifiedStoreImpl) getUser(ctx context.Context, uid string) (*user.User, error) {
	userID, err := strconv.ParseInt(uid, 10, 64)
	if err == nil {
		return ss.userService.GetByID(ctx, &user.GetUserByIDQuery{ID: userID})
	}
	return ss.userService.GetByUID(ctx, &user.GetUserByUIDQuery{UID: uid})
}

func toUID(rawIdentifier string) string {
	parts := strings.Split(rawIdentifier, ":")
	if len(parts) < 2 {
		return ""
	}
	if parts[0] != "user" {
		return ""
	}
	return parts[1]
}
