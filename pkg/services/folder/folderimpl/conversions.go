package folderimpl

import (
	"context"
	"errors"
	"strconv"
	"strings"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/user"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func (ss *FolderUnifiedStoreImpl) UnstructuredToLegacyFolder(ctx context.Context, item *unstructured.Unstructured) (*folder.Folder, error) {
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

	created := meta.GetCreationTimestamp().Time.UTC()
	updated, _ := meta.GetUpdatedTimestamp()
	if updated == nil {
		updated = &created
	} else {
		tmp := updated.UTC()
		updated = &tmp
	}

	creator, err := ss.getUserFromMeta(ctx, meta.GetCreatedBy())
	if err != nil {
		return nil, err
	}

	updater, err := ss.getUserFromMeta(ctx, meta.GetUpdatedBy())
	if err != nil {
		return nil, err
	}
	if updater.UID == "" {
		updater = creator
	}

	return &folder.Folder{
		UID:         uid,
		Title:       title,
		Description: description,
		ID:          meta.GetDeprecatedInternalID(), // nolint:staticcheck
		ParentUID:   meta.GetFolder(),
		Version:     int(meta.GetGeneration()),
		Repository:  meta.GetRepositoryName(),

		URL:       url,
		Created:   created,
		Updated:   *updated,
		OrgID:     info.OrgID,
		CreatedBy: creator.ID,
		UpdatedBy: updater.ID,
	}, nil
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
	return parts[1]
}
