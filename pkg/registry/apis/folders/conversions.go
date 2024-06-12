package folders

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/folder"
)

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
				Key:  fmt.Sprintf("%d", v.ID), // nolint:staticcheck
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
