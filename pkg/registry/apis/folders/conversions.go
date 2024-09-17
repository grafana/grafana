package folders

import (
	"fmt"
	"strconv"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
)

func LegacyCreateCommandToUnstructured(cmd folder.CreateFolderCommand) unstructured.Unstructured {
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
	setParentUID(&obj, cmd.ParentUID)
	return obj
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

func setParentUID(u *unstructured.Unstructured, parentUid string) {
	meta, err := utils.MetaAccessor(u)
	if err != nil {
		return
	}
	meta.SetFolder(parentUid)
}

func getParentUID(item *unstructured.Unstructured) string {
	meta, err := utils.MetaAccessor(item)
	if err != nil {
		return ""
	}
	return meta.GetFolder()
}

func getLegacyID(item *unstructured.Unstructured) int64 {
	meta, err := utils.MetaAccessor(item)
	if err != nil {
		return 0
	}
	info, _ := meta.GetOriginInfo()
	if info != nil && info.Name == "SQL" {
		i, err := strconv.ParseInt(info.Path, 10, 64)
		if err == nil {
			return i
		}
	}
	return 0
}

// #TODO convert GetCreatedBy() return value to a struct--id and name
func getCreatedBy(item *unstructured.Unstructured) string {
	meta, err := utils.MetaAccessor(item)
	if err != nil {
		return ""
	}
	return meta.GetCreatedBy()
}

func getUpdatedBy(item *unstructured.Unstructured) string {
	meta, err := utils.MetaAccessor(item)
	if err != nil {
		return ""
	}
	return meta.GetUpdatedBy()
}

func getURL(item *unstructured.Unstructured) string {
	meta, err := utils.MetaAccessor(item)
	if err != nil {
		return ""
	}
	slug := meta.GetSlug()
	uid := meta.GetName()
	return dashboards.GetFolderURL(uid, slug)
}

func UnstructuredToLegacyFolder(item unstructured.Unstructured) *folder.Folder {
	spec := item.Object["spec"].(map[string]any)
	return &folder.Folder{
		UID:   item.GetName(),
		Title: spec["title"].(string),
		// #TODO add other fields
	}
}

func UnstructuredToLegacyFolderDTO(item unstructured.Unstructured) *dtos.Folder {
	spec := item.Object["spec"].(map[string]any)
	uid := item.GetName()
	title := spec["title"].(string)

	dto := &dtos.Folder{
		UID:   uid,
		Title: title,
		// #TODO reduce repetition with metaaccessor creation
		ID:        getLegacyID(&item),
		ParentUID: getParentUID(&item),
		CreatedBy: getCreatedBy(&item),
		UpdatedBy: getUpdatedBy(&item),
		URL:       getURL(&item),
		// #TODO figure out how to set these properly
		CanSave:   true,
		CanEdit:   true,
		CanAdmin:  true,
		CanDelete: true,
		HasACL:    false,

		// #TODO figure out about adding version and parents fields
	}
	return dto
}

func convertToK8sResource(v *folder.Folder, namespacer request.NamespaceMapper) *v0alpha1.Folder {
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
	if err == nil {
		meta.SetUpdatedTimestamp(&v.Updated)
		if v.ID > 0 { // nolint:staticcheck
			meta.SetOriginInfo(&utils.ResourceOriginInfo{
				Name: "SQL",
				Path: fmt.Sprintf("%d", v.ID), // nolint:staticcheck
				// #TODO check if timestamp is correct
				Timestamp: &v.Created,
			})
		}
		if v.CreatedBy > 0 {
			meta.SetCreatedBy(fmt.Sprintf("user:%d", v.CreatedBy))
		}
		if v.UpdatedBy > 0 {
			meta.SetUpdatedBy(fmt.Sprintf("user:%d", v.UpdatedBy))
		}
	}
	if v.ParentUID != "" {
		meta.SetFolder(v.ParentUID)
	}
	// #TODO find a better way to set it
	if v.URL != "" {
		splits := strings.Split(v.URL, v.UID+"/")
		if len(splits) == 2 {
			meta.SetSlug(splits[1])
		}
	}
	f.UID = gapiutil.CalculateClusterWideUID(f)
	return f
}
