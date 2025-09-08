package folders

import (
	"fmt"
	"strconv"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	claims "github.com/grafana/authlib/types"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/util"
)

func LegacyCreateCommandToUnstructured(cmd *folder.CreateFolderCommand) (*unstructured.Unstructured, error) {
	obj := &unstructured.Unstructured{
		Object: map[string]any{
			"spec": map[string]any{
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

func LegacyFolderToUnstructured(v *folder.Folder, namespacer request.NamespaceMapper) (*folders.Folder, error) {
	return convertToK8sResource(v, namespacer)
}

func convertToK8sResource(v *folder.Folder, namespacer request.NamespaceMapper) (*folders.Folder, error) {
	f := &folders.Folder{
		TypeMeta: folders.FolderResourceInfo.TypeMeta(),
		ObjectMeta: metav1.ObjectMeta{
			Name:              v.UID,
			ResourceVersion:   fmt.Sprintf("%d", v.Updated.UnixMilli()),
			CreationTimestamp: metav1.NewTime(v.Created),
			Namespace:         namespacer(v.OrgID),
			Generation:        int64(v.Version),
		},
		Spec: folders.FolderSpec{
			Title:       v.Title,
			Description: &v.Description,
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

	if v.Fullpath != "" {
		meta.SetFullpath(v.Fullpath)
	}

	if v.FullpathUIDs != "" {
		meta.SetFullpathUIDs(v.FullpathUIDs)
	}

	if v.CreatedBy != 0 {
		meta.SetCreatedBy(claims.NewTypeID(claims.TypeUser, strconv.FormatInt(v.CreatedBy, 10)))
	}
	if v.UpdatedBy != 0 {
		meta.SetUpdatedBy(claims.NewTypeID(claims.TypeUser, strconv.FormatInt(v.UpdatedBy, 10)))
	}
	if v.ParentUID != "" {
		meta.SetFolder(v.ParentUID)
	}
	f.UID = gapiutil.CalculateClusterWideUID(f)
	return f, nil
}
