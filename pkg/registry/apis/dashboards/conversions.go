package dashboards

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	dashboards "github.com/grafana/grafana/pkg/apis/dashboards/v0alpha1"
	"github.com/grafana/grafana/pkg/kinds"
	dashboardssvc "github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
)

func convertToK8sResource(v *dashboardssvc.Dashboard, namespacer request.NamespaceMapper) *dashboards.DashboardResource {
	dash := &dashboards.DashboardResource{
		ObjectMeta: metav1.ObjectMeta{
			Name:              v.UID,
			ResourceVersion:   fmt.Sprintf("%d", v.Updated.UnixMilli()),
			CreationTimestamp: metav1.NewTime(v.Created),
			Namespace:         namespacer(v.OrgID),
		},
		Spec: v.Data,
	}
	meta := kinds.GrafanaResourceMetadata{}
	meta.SetSlug(v.Slug)
	meta.SetUpdatedTimestampMillis(v.Created.UnixMilli())
	if v.CreatedBy > 0 {
		meta.SetCreatedBy(fmt.Sprintf("%d", v.CreatedBy))
	}
	if v.UpdatedBy > 0 {
		meta.SetUpdatedBy(fmt.Sprintf("%d", v.UpdatedBy))
	}
	if v.PluginID != "" {
		meta.SetOriginInfo(&kinds.ResourceOriginInfo{
			Name: "plugin",
			Key:  v.PluginID,
		})
	}
	if v.FolderUID != "" {
		meta.SetFolder(v.FolderUID)
	}
	dash.SetAnnotations(meta.Annotations)
	return dash
}
