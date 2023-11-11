package dashboards

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	dashboards "github.com/grafana/grafana/pkg/apis/dashboards/v0alpha1"
	"github.com/grafana/grafana/pkg/kinds"
	dashboardssvc "github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/util"
)

func convertToK8sResource(v *dashboardssvc.Dashboard,
	provisioningData *dashboardssvc.DashboardProvisioning,
	namespacer request.NamespaceMapper) *dashboards.DashboardResource {
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

	if provisioningData != nil {
		origin := &kinds.ResourceOriginInfo{
			Name: provisioningData.Name,
			Key:  provisioningData.CheckSum,
			Path: provisioningData.ExternalID,
		}
		if provisioningData.Updated > 0 {
			origin.Timestamp = util.Pointer(time.UnixMilli(provisioningData.Updated))
		}
		meta.SetOriginInfo(origin)

		// allowUIUpdate := hs.ProvisioningService.GetAllowUIUpdatesFromConfig(provisioningData.Name)
		// if !allowUIUpdate {
		// 	meta.Provisioned = true
		// }

		// meta.ProvisionedExternalId, err = filepath.Rel(
		// 	hs.ProvisioningService.GetDashboardProvisionerResolvedPath(provisioningData.Name),
		// 	provisioningData.ExternalID,
		// )
		// if err != nil {
		// 	// Not sure when this could happen so not sure how to better handle this. Right now ProvisionedExternalId
		// 	// is for better UX, showing in Save/Delete dialogs and so it won't break anything if it is empty.
		// 	hs.log.Warn("Failed to create ProvisionedExternalId", "err", err)
		// }
	}

	dash.SetAnnotations(meta.Annotations)
	return dash
}
