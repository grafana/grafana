package snapshots

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	snapshots "github.com/grafana/grafana/pkg/apis/snapshots/v0alpha1"
	"github.com/grafana/grafana/pkg/kinds"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
)

func convertDTOToSummary(v *dashboardsnapshots.DashboardSnapshotDTO, namespacer request.NamespaceMapper) *snapshots.DashboardSnapshot {
	meta := kinds.GrafanaResourceMetadata{}
	if v.Updated != v.Created {
		meta.SetUpdatedTimestamp(&v.Updated)
	}
	expires := v.Expires.UnixMilli()
	if v.Expires.After(time.Date(2070, time.January, 0, 0, 0, 0, 0, time.UTC)) {
		expires = 0 // ignore things expiring long into the future
	}
	return &snapshots.DashboardSnapshot{
		TypeMeta: metav1.TypeMeta{
			Kind:       "DashboardSnapshot",
			APIVersion: VersionID,
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:              v.Key,
			ResourceVersion:   fmt.Sprintf("%d", v.Updated.UnixMilli()),
			CreationTimestamp: metav1.NewTime(v.Created),
			Namespace:         namespacer(v.OrgID),
			Annotations:       meta.Annotations,
		},
		Info: snapshots.SnapshotInfo{
			Title:       v.Name,
			ExternalURL: v.ExternalURL,
			Expires:     expires,
		},
	}
}

func convertSnapshotToK8sResource(v *dashboardsnapshots.DashboardSnapshot, namespacer request.NamespaceMapper) *snapshots.DashboardSnapshot {
	meta := kinds.GrafanaResourceMetadata{}
	if v.Updated != v.Created {
		meta.SetUpdatedTimestamp(&v.Updated)
	}
	expires := v.Expires.UnixMilli()
	if v.Expires.After(time.Date(2070, time.January, 0, 0, 0, 0, 0, time.UTC)) {
		expires = 0 // ignore things expiring long into the future
	}

	info := snapshots.SnapshotInfo{
		Title:       v.Name,
		ExternalURL: v.ExternalURL,
		Expires:     expires,
	}
	s := v.Dashboard.Get("snapshot")
	if s != nil {
		info.OriginalUrl, _ = s.Get("originalUrl").String()
		info.Timestamp, _ = s.Get("timestamp").String()
	}
	return &snapshots.DashboardSnapshot{
		ObjectMeta: metav1.ObjectMeta{
			Name:              v.Key,
			ResourceVersion:   fmt.Sprintf("%d", v.Updated.UnixMilli()),
			CreationTimestamp: metav1.NewTime(v.Created),
			Namespace:         namespacer(v.OrgID),
			Annotations:       meta.Annotations,
		},
		Dashboard: v.Dashboard,
		Info:      info,
	}
}

// func convertToLegacyUpdateCommand(p *playlist.Playlist, orgId int64) (*playlistsvc.UpdatePlaylistCommand, error) {
// 	spec := p.Spec
// 	cmd := &playlistsvc.UpdatePlaylistCommand{
// 		UID:      p.Name,
// 		Name:     spec.Title,
// 		Interval: spec.Interval,
// 		OrgId:    orgId,
// 	}
// 	for _, item := range spec.Items {
// 		if item.Type == playlist.ItemTypeDashboardById {
// 			return nil, fmt.Errorf("unsupported item type: %s", item.Type)
// 		}
// 		cmd.Items = append(cmd.Items, playlistsvc.PlaylistItem{
// 			Type:  string(item.Type),
// 			Value: item.Value,
// 		})
// 	}
// 	return cmd, nil
// }

// // Read legacy ID from metadata annotations
// func getLegacyID(item *unstructured.Unstructured) int64 {
// 	meta := kinds.GrafanaResourceMetadata{
// 		Annotations: item.GetAnnotations(),
// 	}
// 	info := meta.GetOriginInfo()
// 	if info != nil && info.Name == "SQL" {
// 		i, err := strconv.ParseInt(info.Key, 10, 64)
// 		if err == nil {
// 			return i
// 		}
// 	}
// 	return 0
// }
