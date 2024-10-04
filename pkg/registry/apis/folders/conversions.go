package folders

import (
	"fmt"
	"strconv"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
)

func LegacyCreateCommandToUnstructured(cmd folder.CreateFolderCommand) (unstructured.Unstructured, error) {
	obj := unstructured.Unstructured{
		Object: map[string]interface{}{
			"spec": map[string]interface{}{
				"title":       cmd.Title,
				"description": cmd.Description,
			},
		},
	}
	// #TODO: let's see if we need to set the json field to "-"
	obj.SetName(cmd.UID)

	if err := setParentUID(&obj, cmd.ParentUID); err != nil {
		return unstructured.Unstructured{}, err
	}

	return obj, nil
}

func LegacyUpdateCommandToUnstructured(cmd folder.UpdateFolderCommand) unstructured.Unstructured {
	// #TODO add other fields
	obj := unstructured.Unstructured{
		Object: map[string]interface{}{
			"spec": map[string]interface{}{
				"title": cmd.NewTitle,
			},
		},
	}
	obj.SetName(cmd.UID)
	return obj
}

func UnstructuredToLegacyFolder(item unstructured.Unstructured) *folder.Folder {
	spec := item.Object["spec"].(map[string]any)
	return &folder.Folder{
		UID:   item.GetName(),
		Title: spec["title"].(string),
		// #TODO add other fields
	}
}

func UnstructuredToLegacyFolderDTO(item unstructured.Unstructured) (*dtos.Folder, error) {
	spec := item.Object["spec"].(map[string]any)
	uid := item.GetName()
	title := spec["title"].(string)

	meta, err := utils.MetaAccessor(&item)
	if err != nil {
		return nil, err
	}

	id, err := getLegacyID(meta)
	if err != nil {
		return nil, err
	}

	created, err := getCreated(meta)
	if err != nil {
		return nil, err
	}

	dto := &dtos.Folder{
		UID:       uid,
		Title:     title,
		ID:        id,
		ParentUID: meta.GetFolder(),
		// #TODO add back CreatedBy, UpdatedBy once we figure out how to access userService
		// to translate user ID into user login. meta.GetCreatedBy() only stores user ID
		// Could convert meta.GetCreatedBy() return value to a struct--id and name
		// CreatedBy: meta.GetCreatedBy(),
		// UpdatedBy: meta.GetCreatedBy(),
		URL: getURL(meta, title),
		// #TODO get Created in format "2024-09-12T15:37:41.09466+02:00"
		Created: *created,
		// #TODO figure out whether we want to set "updated" and "updated by". Could replace with
		// meta.GetUpdatedTimestamp() but it currently gets overwritten in prepareObjectForStorage().
		Updated: *created,
		// #TODO figure out how to set these properly
		CanSave:   true,
		CanEdit:   true,
		CanAdmin:  true,
		CanDelete: true,
		HasACL:    false,

		// #TODO figure out about adding version, parents, orgID fields
	}
	return dto, nil
}

func convertToK8sResource(v *folder.Folder, namespacer request.NamespaceMapper) (*v0alpha1.Folder, error) {
	f := &v0alpha1.Folder{
		TypeMeta: v0alpha1.FolderResourceInfo.TypeMeta(),
		ObjectMeta: metav1.ObjectMeta{
			Name:              v.UID,
			ResourceVersion:   fmt.Sprintf("%d", v.Updated.UnixMilli()),
			CreationTimestamp: metav1.NewTime(v.Created),
			Namespace:         namespacer(v.OrgID),
		},
		Spec: v0alpha1.Spec{
			Title:       v.Title,
			Description: v.Description,
		},
	}

	meta, err := utils.MetaAccessor(f)
	if err != nil {
		return nil, err
	}

	meta.SetUpdatedTimestamp(&v.Updated)
	if v.ID > 0 { // nolint:staticcheck
		meta.SetOriginInfo(&utils.ResourceOriginInfo{
			Name:      "SQL",
			Path:      fmt.Sprintf("%d", v.ID), // nolint:staticcheck
			Timestamp: &v.Created,
		})
	}
	if v.CreatedBy > 0 {
		meta.SetCreatedBy(fmt.Sprintf("user:%d", v.CreatedBy))
	}
	if v.UpdatedBy > 0 {
		meta.SetUpdatedBy(fmt.Sprintf("user:%d", v.UpdatedBy))
	}
	if v.ParentUID != "" {
		meta.SetFolder(v.ParentUID)
	}
	f.UID = gapiutil.CalculateClusterWideUID(f)
	return f, nil
}

func setParentUID(u *unstructured.Unstructured, parentUid string) error {
	meta, err := utils.MetaAccessor(u)
	if err != nil {
		return err
	}
	meta.SetFolder(parentUid)
	return nil
}

func getLegacyID(meta utils.GrafanaMetaAccessor) (int64, error) {
	var i int64

	info, err := meta.GetOriginInfo()
	if err != nil {
		return i, err
	}

	if info != nil && info.Name == "SQL" {
		i, err = strconv.ParseInt(info.Path, 10, 64)
		if err != nil {
			return i, err
		}
	}
	return i, nil
}

func getURL(meta utils.GrafanaMetaAccessor, title string) string {
	slug := slugify.Slugify(title)
	uid := meta.GetName()
	return dashboards.GetFolderURL(uid, slug)
}

func getCreated(meta utils.GrafanaMetaAccessor) (*time.Time, error) {
	created, err := meta.GetOriginTimestamp()
	if err != nil {
		return nil, err
	}
	return created, nil
}
