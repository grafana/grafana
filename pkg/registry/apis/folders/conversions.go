package folders

import (
	"fmt"
	"regexp"
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

func UnstructuredToLegacyFolder(item unstructured.Unstructured, orgID int64) *folder.Folder {
	// #TODO reduce duplication of the different conversion functions
	spec := item.Object["spec"].(map[string]any)
	uid := item.GetName()
	title := spec["title"].(string)

	meta, err := utils.MetaAccessor(&item)
	if err != nil {
		return nil
	}

	id, err := getLegacyID(meta)
	if err != nil {
		return nil
	}

	created, err := getCreated(meta)
	if err != nil {
		return nil
	}

	// avoid panic
	var createdTime time.Time
	if created != nil {
		createdTime = created.Local()
	}

	f := &folder.Folder{
		UID:       uid,
		Title:     title,
		ID:        id,
		ParentUID: meta.GetFolder(),
		// #TODO add created by field if necessary
		// CreatedBy: meta.GetCreatedBy(),
		// UpdatedBy: meta.GetCreatedBy(),
		URL:          getURL(meta, title),
		Created:      createdTime,
		Updated:      createdTime,
		OrgID:        orgID,
		Fullpath:     meta.GetFullPath(),
		FullpathUIDs: meta.GetFullPathUIDs(),
	}
	return f
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

	// avoid panic
	var createdTime time.Time
	if created != nil {
		// #TODO Fix this time format. The legacy time format seems to be along the lines of time.Now()
		// which includes a part that represents a fraction of a second.
		createdTime = created.Local()
	}

	dto := &dtos.Folder{
		UID:       uid,
		Title:     title,
		ID:        id,
		ParentUID: meta.GetFolder(),
		// #TODO add back CreatedBy, UpdatedBy once we figure out how to access userService
		// to translate user ID into user login. meta.GetCreatedBy() only stores user ID
		// Could convert meta.GetCreatedBy() return value to a struct--id and name
		CreatedBy: meta.GetCreatedBy(),
		UpdatedBy: meta.GetCreatedBy(),
		URL:       getURL(meta, title),
		// #TODO get Created in format "2024-09-12T15:37:41.09466+02:00"
		Created: createdTime,
		// #TODO figure out whether we want to set "updated" and "updated by". Could replace with
		// meta.GetUpdatedTimestamp() but it currently gets overwritten in prepareObjectForStorage().
		Updated: createdTime,

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
	if v.Fullpath != "" {
		meta.SetFullPath(v.Fullpath)
	}
	if v.FullpathUIDs != "" {
		meta.SetFullPathUIDs(v.FullpathUIDs)
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

func GetParentTitles(fullPath string) ([]string, error) {
	// Find all forward slashes which aren't escaped
	r, err := regexp.Compile(`[^\\](/)`)
	if err != nil {
		return nil, err
	}
	indices := r.FindAllStringIndex(fullPath, -1)

	var start int
	titles := []string{}
	for _, i := range indices {
		titles = append(titles, fullPath[start:i[0]+1])
		start = i[0] + 2
	}

	titles = append(titles, fullPath[start:])
	return titles, nil
}
