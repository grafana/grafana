package v0alpha1

import (
	"fmt"
	"strconv"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana/pkg/kinds"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/util"
)

func UnstructuredToLegacyPlaylist(item unstructured.Unstructured) *playlist.Playlist {
	spec := item.Object["spec"].(map[string]any)
	return &playlist.Playlist{
		UID:      item.GetName(),
		Name:     spec["title"].(string),
		Interval: spec["interval"].(string),
		Id:       getLegacyID(&item),
	}
}

func UnstructuredToLegacyPlaylistDTO(item unstructured.Unstructured) *playlist.PlaylistDTO {
	spec := item.Object["spec"].(map[string]any)
	dto := &playlist.PlaylistDTO{
		Uid:      item.GetName(),
		Name:     spec["title"].(string),
		Interval: spec["interval"].(string),
		Id:       getLegacyID(&item),
	}
	return dto
}

func convertToK8sResource(v *playlist.PlaylistDTO, namespacer request.NamespaceMapper) *Playlist {
	spec := Spec{
		Title:    v.Name,
		Interval: v.Interval,
	}
	for _, item := range v.Items {
		spec.Items = append(spec.Items, Item{
			Type:  ItemType(item.Type),
			Value: item.Value,
		})
	}

	meta := kinds.GrafanaResourceMetadata{}
	if v.UpdatedAt > 0 {
		meta.SetUpdatedTimestamp(util.Pointer(time.UnixMilli(v.UpdatedAt)))
	}
	if v.Id > 0 {
		meta.SetOriginInfo(&kinds.ResourceOriginInfo{
			Name: "SQL",
			Key:  fmt.Sprintf("%d", v.Id),
		})
	}
	return &Playlist{
		ObjectMeta: metav1.ObjectMeta{
			Name:              v.Uid,
			UID:               types.UID(v.Uid),
			ResourceVersion:   fmt.Sprintf("%d", v.UpdatedAt),
			CreationTimestamp: metav1.NewTime(time.UnixMilli(v.CreatedAt)),
			Namespace:         namespacer(v.OrgID),
			Annotations:       meta.Annotations,
		},
		Spec: spec,
	}
}

// Convert Legacy ID to
func getLegacyID(item *unstructured.Unstructured) int64 {
	s, ok := item.GetAnnotations()["grafana.com/originKey"]
	if ok {
		i, err := strconv.ParseInt(s, 10, 64)
		if err == nil {
			return i
		}
	}
	return 0
}
