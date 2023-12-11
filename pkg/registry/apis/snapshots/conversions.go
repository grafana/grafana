package snapshots

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apis/snapshots/v0alpha1"
	"github.com/grafana/grafana/pkg/kinds"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
)

func convertDTOToSnapshot(v *dashboardsnapshots.DashboardSnapshotDTO, namespacer request.NamespaceMapper) *v0alpha1.DashboardSnapshot {
	meta := kinds.GrafanaResourceMetadata{}
	if v.Updated != v.Created {
		meta.SetUpdatedTimestamp(&v.Updated)
	}
	expires := v.Expires.UnixMilli()
	if v.Expires.After(time.Date(2070, time.January, 0, 0, 0, 0, 0, time.UTC)) {
		expires = 0 // ignore things expiring long into the future
	}
	return &v0alpha1.DashboardSnapshot{
		TypeMeta: resourceInfo.TypeMeta(),
		ObjectMeta: metav1.ObjectMeta{
			Name:              v.Key,
			ResourceVersion:   fmt.Sprintf("%d", v.Updated.UnixMilli()),
			CreationTimestamp: metav1.NewTime(v.Created),
			Namespace:         namespacer(v.OrgID),
			Annotations:       meta.Annotations,
		},
		Spec: v0alpha1.SnapshotInfo{
			Title:       v.Name,
			ExternalURL: v.ExternalURL,
			Expires:     expires,
		},
	}
}

func convertSnapshotToK8sResource(v *dashboardsnapshots.DashboardSnapshot, namespacer request.NamespaceMapper) *v0alpha1.DashboardSnapshot {
	meta := kinds.GrafanaResourceMetadata{}
	if v.Updated != v.Created {
		meta.SetUpdatedTimestamp(&v.Updated)
	}
	expires := v.Expires.UnixMilli()
	if v.Expires.After(time.Date(2070, time.January, 0, 0, 0, 0, 0, time.UTC)) {
		expires = 0 // ignore things expiring long into the future
	}

	info := v0alpha1.SnapshotInfo{
		Title:       v.Name,
		ExternalURL: v.ExternalURL,
		Expires:     expires,
	}
	s := v.Dashboard.Get("snapshot")
	if s != nil {
		info.OriginalUrl, _ = s.Get("originalUrl").String()
		info.Timestamp, _ = s.Get("timestamp").String()
	}
	return &v0alpha1.DashboardSnapshot{
		ObjectMeta: metav1.ObjectMeta{
			Name:              v.Key,
			ResourceVersion:   fmt.Sprintf("%d", v.Updated.UnixMilli()),
			CreationTimestamp: metav1.NewTime(v.Created),
			Namespace:         namespacer(v.OrgID),
			Annotations:       meta.Annotations,
		},
		Spec: info,
	}
}
