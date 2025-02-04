package folders

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/util"
)

func LegacyCreateCommandToUnstructured(cmd *folder.CreateFolderCommand) (*unstructured.Unstructured, error) {
	obj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"spec": map[string]interface{}{
				"title":       cmd.Title,
				"description": cmd.Description,
			},
		},
	}

	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return nil, err
	}

	if cmd.UID == "" {
		cmd.UID = util.GenerateShortUID()
	}
	meta.SetName(cmd.UID)
	meta.SetFolder(cmd.ParentUID)

	return obj, nil
}

func LegacyFolderToUnstructured(v *folder.Folder, namespacer request.NamespaceMapper) (*v0alpha1.Folder, error) {
	return convertToK8sResource(v, namespacer)
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
		meta.SetDeprecatedInternalID(v.ID) // nolint:staticcheck
	}
	// #TODO: turns out these get overwritten by Unified Storage (see pkg/storage/unified/apistore/prepare.go)
	// We're going to have to align with that. For now we do need the user ID because the folder type stores it
	// as the only user identifier

	if v.CreatedByUID != "" {
		meta.SetCreatedBy(v.UpdatedByUID)
	}
	if v.UpdatedByUID != "" {
		meta.SetUpdatedBy(v.UpdatedByUID)
	}
	if v.ParentUID != "" {
		meta.SetFolder(v.ParentUID)
	}
	f.UID = gapiutil.CalculateClusterWideUID(f)
	return f, nil
}
