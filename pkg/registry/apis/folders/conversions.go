package folders

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/dashboards"
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
	// #TODO: let's see if we need to set the json field to "-"
	if cmd.UID == "" {
		cmd.UID = util.GenerateShortUID()
	}
	obj.SetName(cmd.UID)

	if err := setParentUID(obj, cmd.ParentUID); err != nil {
		return &unstructured.Unstructured{}, err
	}

	return obj, nil
}

func LegacyUpdateCommandToUnstructured(obj *unstructured.Unstructured, cmd *folder.UpdateFolderCommand) (*unstructured.Unstructured, error) {
	spec, ok := obj.Object["spec"].(map[string]any)
	if !ok {
		return &unstructured.Unstructured{}, fmt.Errorf("could not convert object to folder")
	}
	if cmd.NewTitle != nil {
		spec["title"] = cmd.NewTitle
	}
	if cmd.NewDescription != nil {
		spec["description"] = cmd.NewDescription
	}
	if cmd.NewParentUID != nil {
		if err := setParentUID(obj, *cmd.NewParentUID); err != nil {
			return &unstructured.Unstructured{}, err
		}
	}

	return obj, nil
}

func LegacyMoveCommandToUnstructured(obj *unstructured.Unstructured, cmd folder.MoveFolderCommand) (*unstructured.Unstructured, error) {
	if err := setParentUID(obj, cmd.NewParentUID); err != nil {
		return &unstructured.Unstructured{}, err
	}

	return obj, nil
}

func UnstructuredToLegacyFolder(item *unstructured.Unstructured) (*folder.Folder, error) {
	meta, err := utils.MetaAccessor(item)
	if err != nil {
		return nil, err
	}

	info, err := authlib.ParseNamespace(meta.GetNamespace())
	if err != nil {
		return nil, err
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

	return &folder.Folder{
		UID:         uid,
		Title:       title,
		Description: description,
		ID:          meta.GetDeprecatedInternalID(), // nolint:staticcheck
		ParentUID:   meta.GetFolder(),
		Version:     int(meta.GetGeneration()),
		Repository:  meta.GetRepositoryName(),

		URL:     url,
		Created: created,
		Updated: *updated,
		OrgID:   info.OrgID,
	}, nil
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

func setParentUID(u *unstructured.Unstructured, parentUid string) error {
	meta, err := utils.MetaAccessor(u)
	if err != nil {
		return err
	}
	meta.SetFolder(parentUid)
	return nil
}
