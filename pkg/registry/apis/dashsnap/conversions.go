package dashsnap

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	dashsnap "github.com/grafana/grafana/pkg/apis/dashsnap/v0alpha1"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/utils"
)

func convertDTOToSnapshot(v *dashboardsnapshots.DashboardSnapshotDTO, namespacer request.NamespaceMapper) *dashsnap.DashboardSnapshot {
	expires := v.Expires.UnixMilli()
	if v.Expires.After(time.Date(2070, time.January, 0, 0, 0, 0, 0, time.UTC)) {
		expires = 0 // ignore things expiring long into the future
	}
	snap := &dashsnap.DashboardSnapshot{
		TypeMeta: resourceInfo.TypeMeta(),
		ObjectMeta: metav1.ObjectMeta{
			Name:              v.Key,
			ResourceVersion:   fmt.Sprintf("%d", v.Updated.UnixMilli()),
			CreationTimestamp: metav1.NewTime(v.Created),
			Namespace:         namespacer(v.OrgID),
		},
		Spec: dashsnap.SnapshotInfo{
			Title:       v.Name,
			ExternalURL: v.ExternalURL,
			Expires:     expires,
		},
	}
	if v.Updated != v.Created {
		meta, _ := utils.MetaAccessor(snap)
		meta.SetUpdatedTimestamp(&v.Updated)
	}
	return snap
}

func convertSnapshotToK8sResource(v *dashboardsnapshots.DashboardSnapshot, namespacer request.NamespaceMapper) *dashsnap.DashboardSnapshot {
	expires := v.Expires.UnixMilli()
	if v.Expires.After(time.Date(2070, time.January, 0, 0, 0, 0, 0, time.UTC)) {
		expires = 0 // ignore things expiring long into the future
	}

	info := dashsnap.SnapshotInfo{
		Title:       v.Name,
		ExternalURL: v.ExternalURL,
		Expires:     expires,
	}
	s := v.Dashboard.Get("snapshot")
	if s != nil {
		info.OriginalUrl, _ = s.Get("originalUrl").String()
		info.Timestamp, _ = s.Get("timestamp").String()
	}
	snap := &dashsnap.DashboardSnapshot{
		ObjectMeta: metav1.ObjectMeta{
			Name:              v.Key,
			ResourceVersion:   fmt.Sprintf("%d", v.Updated.UnixMilli()),
			CreationTimestamp: metav1.NewTime(v.Created),
			Namespace:         namespacer(v.OrgID),
		},
		Spec: info,
	}
	if v.Updated != v.Created {
		meta, _ := utils.MetaAccessor(snap)
		meta.SetUpdatedTimestamp(&v.Updated)
	}
	return snap
}
