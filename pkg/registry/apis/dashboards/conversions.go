package dashboards

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	dashboards "github.com/grafana/grafana/pkg/apis/dashboards/v0alpha1"
	"github.com/grafana/grafana/pkg/kinds"
	dashboardssvc "github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
)

func convertToK8sResource(v *dashboardssvc.Dashboard, namespacer request.NamespaceMapper) *dashboards.DashboardResource {
	dash := &dashboards.DashboardResource{
		ObjectMeta: metav1.ObjectMeta{
			Name:              v.UID,
			UID:               types.UID(v.UID),
			ResourceVersion:   fmt.Sprintf("%d", v.Updated.UnixMilli()),
			CreationTimestamp: metav1.NewTime(v.Created),
			Namespace:         namespacer(v.OrgID),
		},
		Spec: v.Data,
	}
	meta := kinds.GrafanaResourceMetadata{}
	meta.SetUpdatedTimestampMillis(v.Created.UnixMilli())
	meta.SetCreatedBy(fmt.Sprintf("%d", v.CreatedBy))
	meta.SetUpdatedBy(fmt.Sprintf("%d", v.UpdatedBy))
	if v.ID > 0 {
		meta.SetOriginInfo(&kinds.ResourceOriginInfo{
			Name: "SQL",
			Key:  fmt.Sprintf("%d", v.ID),
		})
	}
	dash.SetAnnotations(meta.Annotations)
	return dash
}
