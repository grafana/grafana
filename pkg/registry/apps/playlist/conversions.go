package playlist

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"

	playlist "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	playlistsvc "github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/util"
)

func LegacyUpdateCommandToUnstructured(cmd playlistsvc.UpdatePlaylistCommand) unstructured.Unstructured {
	items := []map[string]string{}
	for _, item := range cmd.Items {
		items = append(items, map[string]string{
			"type":  item.Type,
			"value": item.Value,
		})
	}
	obj := unstructured.Unstructured{
		Object: map[string]interface{}{
			"spec": map[string]interface{}{
				"title":    cmd.Name,
				"interval": cmd.Interval,
				"items":    items,
			},
		},
	}
	if cmd.UID == "" {
		cmd.UID = util.GenerateShortUID()
	}
	obj.SetName(cmd.UID)
	return obj
}

func UnstructuredToLegacyPlaylist(item unstructured.Unstructured) *playlistsvc.Playlist {
	spec := item.Object["spec"].(map[string]any)
	return &playlistsvc.Playlist{
		UID:      item.GetName(),
		Name:     spec["title"].(string),
		Interval: spec["interval"].(string),
		Id:       getLegacyID(&item),
	}
}

func UnstructuredToLegacyPlaylistDTO(item unstructured.Unstructured) *playlistsvc.PlaylistDTO {
	spec := item.Object["spec"].(map[string]any)
	dto := &playlistsvc.PlaylistDTO{
		Uid:      item.GetName(),
		Name:     spec["title"].(string),
		Interval: spec["interval"].(string),
		Id:       getLegacyID(&item),
	}
	items := spec["items"]
	if items != nil {
		b, err := json.Marshal(items)
		if err == nil {
			_ = json.Unmarshal(b, &dto.Items)
		}
	}
	return dto
}

func convertToK8sResource(v *playlistsvc.PlaylistDTO, namespacer request.NamespaceMapper) *playlist.Playlist {
	spec := playlist.PlaylistSpec{
		Title:    v.Name,
		Interval: v.Interval,
	}
	for _, item := range v.Items {
		spec.Items = append(spec.Items, playlist.PlaylistItem{
			Type:  playlist.PlaylistItemType(item.Type),
			Value: item.Value,
		})
	}

	p := &playlist.Playlist{
		ObjectMeta: metav1.ObjectMeta{
			Name:              v.Uid,
			UID:               types.UID(v.Uid),
			ResourceVersion:   fmt.Sprintf("%d", v.UpdatedAt),
			CreationTimestamp: metav1.NewTime(time.UnixMilli(v.CreatedAt)),
			Namespace:         namespacer(v.OrgID),
		},
		Spec: spec,
	}
	meta, err := utils.MetaAccessor(p)
	if err == nil {
		meta.SetUpdatedTimestampMillis(v.UpdatedAt)
		if v.Id > 0 {
			createdAt := time.UnixMilli(v.CreatedAt)
			meta.SetRepositoryInfo(&utils.ResourceRepositoryInfo{
				Name:      "SQL",
				Path:      fmt.Sprintf("%d", v.Id),
				Timestamp: &createdAt,
			})
		}
	}

	p.UID = gapiutil.CalculateClusterWideUID(p)
	return p
}

func convertToLegacyUpdateCommand(p *playlist.Playlist, orgId int64) (*playlistsvc.UpdatePlaylistCommand, error) {
	spec := p.Spec
	cmd := &playlistsvc.UpdatePlaylistCommand{
		UID:      p.Name,
		Name:     spec.Title,
		Interval: spec.Interval,
		OrgId:    orgId,
	}
	for _, item := range spec.Items {
		if item.Type == playlist.PlaylistItemTypeDashboardById {
			return nil, fmt.Errorf("unsupported item type: %s", item.Type)
		}
		cmd.Items = append(cmd.Items, playlistsvc.PlaylistItem{
			Type:  string(item.Type),
			Value: item.Value,
		})
	}
	return cmd, nil
}

// Read legacy ID from metadata annotations
func getLegacyID(item *unstructured.Unstructured) int64 {
	meta, err := utils.MetaAccessor(item)
	if err != nil {
		return 0
	}
	info, _ := meta.GetRepositoryInfo()
	if info != nil && info.Name == "SQL" {
		i, err := strconv.ParseInt(info.Path, 10, 64)
		if err == nil {
			return i
		}
	}
	return 0
}
