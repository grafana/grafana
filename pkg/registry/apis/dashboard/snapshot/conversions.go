package snapshot

import (
	"fmt"
	"time"

	snapshot "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
)

func convertSnapshotDTOToK8sResource(v *dashboardsnapshots.DashboardSnapshotDTO, namespacer request.NamespaceMapper) *snapshot.Snapshot {
	expires := v.Expires.UnixMilli()
	if v.Expires.After(time.Date(2070, time.January, 0, 0, 0, 0, 0, time.UTC)) {
		expires = 0 // ignore things expiring long into the future
	}
	snap := &snapshot.Snapshot{
		TypeMeta: snapshot.SnapshotResourceInfo.TypeMeta(),
		ObjectMeta: metav1.ObjectMeta{
			Name:              v.Key,
			ResourceVersion:   fmt.Sprintf("%d", v.Updated.UnixMilli()),
			CreationTimestamp: metav1.NewTime(v.Created),
			Namespace:         namespacer(v.OrgID),
		},
		Spec: snapshot.SnapshotSpec{
			Title:       &v.Name,
			ExternalUrl: &v.ExternalURL,
			Expires:     &expires,
		},
	}
	if v.Updated != v.Created {
		meta, _ := utils.MetaAccessor(snap)
		meta.SetUpdatedTimestamp(&v.Updated)
	}
	return snap
}

func convertSnapshotToK8sResource(v *dashboardsnapshots.DashboardSnapshot, namespacer request.NamespaceMapper) *snapshot.Snapshot {
	expires := v.Expires.UnixMilli()
	if v.Expires.After(time.Date(2070, time.January, 0, 0, 0, 0, 0, time.UTC)) {
		expires = 0 // ignore things expiring long into the future
	}

	snap := &snapshot.Snapshot{
		ObjectMeta: metav1.ObjectMeta{
			Name:              v.Key,
			ResourceVersion:   fmt.Sprintf("%d", v.Updated.UnixMilli()),
			CreationTimestamp: metav1.NewTime(v.Created),
			Namespace:         namespacer(v.OrgID),
		},
		Spec: snapshot.SnapshotSpec{
			Title:       &v.Name,
			ExternalUrl: &v.ExternalURL,
			Expires:     &expires,
			Dashboard:   v.Dashboard.Interface().(map[string]interface{}),
		},
	}
	if v.Updated != v.Created {
		meta, _ := utils.MetaAccessor(snap)
		meta.SetUpdatedTimestamp(&v.Updated)
	}
	return snap
}
