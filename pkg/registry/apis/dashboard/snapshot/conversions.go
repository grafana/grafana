package snapshot

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	dashV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
)

func convertSnapshotDTOToK8sResource(v *dashboardsnapshots.DashboardSnapshotDTO, namespacer request.NamespaceMapper) *dashV0.Snapshot {
	expires := v.Expires.UnixMilli()
	if v.Expires.After(time.Date(2070, time.January, 0, 0, 0, 0, 0, time.UTC)) {
		expires = 0 // ignore things expiring long into the future
	}
	snap := &dashV0.Snapshot{
		TypeMeta: dashV0.SnapshotResourceInfo.TypeMeta(),
		ObjectMeta: metav1.ObjectMeta{
			Name:              v.Key,
			ResourceVersion:   fmt.Sprintf("%d", v.Updated.UnixMilli()),
			CreationTimestamp: metav1.NewTime(v.Created),
			Namespace:         namespacer(v.OrgID),
		},
		Spec: dashV0.SnapshotSpec{
			Title: &v.Name,
		},
	}

	// Only show external settings when it is external
	if v.External {
		snap.Spec.External = &v.External
		snap.Spec.ExternalUrl = &v.ExternalURL
	}
	if expires > 0 {
		snap.Spec.Expires = &expires
	}
	if v.Updated != v.Created {
		meta, _ := utils.MetaAccessor(snap)
		meta.SetUpdatedTimestamp(&v.Updated)
	}
	return snap
}

func convertSnapshotToK8sResource(v *dashboardsnapshots.DashboardSnapshot, namespacer request.NamespaceMapper) *dashV0.Snapshot {
	expires := v.Expires.UnixMilli()
	if v.Expires.After(time.Date(2070, time.January, 0, 0, 0, 0, 0, time.UTC)) {
		expires = 0 // ignore things expiring long into the future
	}

	snap := &dashV0.Snapshot{
		ObjectMeta: metav1.ObjectMeta{
			Name:              v.Key,
			ResourceVersion:   fmt.Sprintf("%d", v.Updated.UnixMilli()),
			CreationTimestamp: metav1.NewTime(v.Created),
			Namespace:         namespacer(v.OrgID),
		},
		Spec: dashV0.SnapshotSpec{
			Title:       &v.Name,
			Expires:     &expires,
			External:    &v.External,
			ExternalUrl: &v.ExternalURL,
		},
	}

	// Only show external settings when it is external
	if v.External {
		snap.Spec.External = &v.External
		snap.Spec.ExternalUrl = &v.ExternalURL
	}
	if expires > 0 {
		snap.Spec.Expires = &expires
	}

	if v.Updated != v.Created {
		meta, _ := utils.MetaAccessor(snap)
		meta.SetUpdatedTimestamp(&v.Updated)
	}
	return snap
}

// convertK8sResourceToCreateCommand converts a K8s Snapshot to a CreateDashboardSnapshotCommand
func convertK8sResourceToCreateCommand(snap *dashV0.Snapshot, orgID int64, userID int64) *dashboardsnapshots.CreateDashboardSnapshotCommand {
	cmd := &dashboardsnapshots.CreateDashboardSnapshotCommand{
		OrgID:  orgID,
		UserID: userID,
	}

	// Map title
	if snap.Spec.Title != nil {
		cmd.Name = *snap.Spec.Title
	}

	// Map dashboard (convert map[string]interface{} to *common.Unstructured)
	if snap.Spec.Dashboard != nil {
		cmd.Dashboard = &common.Unstructured{Object: snap.Spec.Dashboard}
	}

	// Map expires
	if snap.Spec.Expires != nil {
		cmd.Expires = *snap.Spec.Expires
	}

	// Map external settings
	if snap.Spec.External != nil && *snap.Spec.External {
		cmd.External = true
		if snap.Spec.ExternalUrl != nil {
			cmd.ExternalURL = *snap.Spec.ExternalUrl
		}
	}

	return cmd
}

// convertCreateCmdToK8sSnapshot converts a CreateDashboardSnapshotCommand request to a K8s Snapshot
// Used by routes.go to create a Snapshot object from the incoming create command
func convertCreateCmdToK8sSnapshot(cmd *dashboardsnapshots.CreateDashboardSnapshotCommand, namespace string) *dashV0.Snapshot {
	snap := &dashV0.Snapshot{
		TypeMeta: dashV0.SnapshotResourceInfo.TypeMeta(),
		ObjectMeta: metav1.ObjectMeta{
			Namespace: namespace,
		},
		Spec: dashV0.SnapshotSpec{
			Title: &cmd.Name,
		},
	}

	// Convert *common.Unstructured to map[string]interface{}
	if cmd.Dashboard != nil {
		snap.Spec.Dashboard = cmd.Dashboard.Object
	}

	if cmd.Expires > 0 {
		snap.Spec.Expires = &cmd.Expires
	}

	if cmd.External {
		snap.Spec.External = &cmd.External
		if cmd.ExternalURL != "" {
			snap.Spec.ExternalUrl = &cmd.ExternalURL
		}
	}

	return snap
}
