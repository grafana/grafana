package dashboardsnapshot

//
//import (
//	"fmt"
//	"time"
//
//	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
//
//	"github.com/grafana/grafana/pkg/apimachinery/utils"
//	dashboardsnapshot "github.com/grafana/grafana/pkg/apis/dashboardsnapshot/v0alpha1"
//	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
//	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
//)
//
//func convertDTOToSnapshot(v *dashboardsnapshots.DashboardSnapshotDTO, namespacer request.NamespaceMapper) *dashboardsnapshot.DashboardSnapshot {
//	expires := v.Expires.UnixMilli()
//	if v.Expires.After(time.Date(2070, time.January, 0, 0, 0, 0, 0, time.UTC)) {
//		expires = 0 // ignore things expiring long into the future
//	}
//	snap := &dashboardsnapshot.DashboardSnapshot{
//		TypeMeta: resourceInfo.TypeMeta(),
//		ObjectMeta: metav1.ObjectMeta{
//			Name:              v.Key,
//			ResourceVersion:   fmt.Sprintf("%d", v.Updated.UnixMilli()),
//			CreationTimestamp: metav1.NewTime(v.Created),
//			Namespace:         namespacer(v.OrgID),
//		},
//		Spec: dashboardsnapshot.SnapshotInfo{
//			Title:       v.Name,
//			ExternalURL: v.ExternalURL,
//			Expires:     expires,
//		},
//	}
//	if v.Updated != v.Created {
//		meta, _ := utils.MetaAccessor(snap)
//		meta.SetUpdatedTimestamp(&v.Updated)
//	}
//	return snap
//}
//
//func convertSnapshotToK8sResource(v *dashboardsnapshots.DashboardSnapshot, namespacer request.NamespaceMapper) *dashboardsnapshot.DashboardSnapshot {
//	expires := v.Expires.UnixMilli()
//	if v.Expires.After(time.Date(2070, time.January, 0, 0, 0, 0, 0, time.UTC)) {
//		expires = 0 // ignore things expiring long into the future
//	}
//
//	info := dashboardsnapshot.SnapshotInfo{
//		Title:       v.Name,
//		ExternalURL: v.ExternalURL,
//		Expires:     expires,
//	}
//	s := v.Dashboard.Get("snapshot")
//	if s != nil {
//		info.OriginalUrl, _ = s.Get("originalUrl").String()
//		info.Timestamp, _ = s.Get("timestamp").String()
//	}
//	snap := &dashboardsnapshot.DashboardSnapshot{
//		ObjectMeta: metav1.ObjectMeta{
//			Name:              v.Key,
//			ResourceVersion:   fmt.Sprintf("%d", v.Updated.UnixMilli()),
//			CreationTimestamp: metav1.NewTime(v.Created),
//			Namespace:         namespacer(v.OrgID),
//		},
//		Spec: info,
//	}
//	if v.Updated != v.Created {
//		meta, _ := utils.MetaAccessor(snap)
//		meta.SetUpdatedTimestamp(&v.Updated)
//	}
//	return snap
//}
