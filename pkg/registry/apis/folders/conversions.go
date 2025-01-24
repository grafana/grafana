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

func UnstructuredToLegacyFolder(item *unstructured.Unstructured) (*folder.Folder, error) {
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
