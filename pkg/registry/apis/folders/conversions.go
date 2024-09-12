package folders

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/folder"
)

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

func UnstructuredToLegacyFolderDTO(item unstructured.Unstructured) *dtos.Folder {
	spec := item.Object["spec"].(map[string]any)
	dto := &dtos.Folder{
		UID:   item.GetName(),
		Title: spec["title"].(string),
		// #TODO add other fields
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
	f.UID = gapiutil.CalculateClusterWideUID(f)
	return f
}
