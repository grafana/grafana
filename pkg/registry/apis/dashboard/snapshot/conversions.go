package snapshot

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	dashV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
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
