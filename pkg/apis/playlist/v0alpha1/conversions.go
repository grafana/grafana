package v0alpha1

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	playlistkind "github.com/grafana/grafana/pkg/kinds/playlist"
	"github.com/grafana/grafana/pkg/services/playlist"
)

func convertToK8sResource(v *playlist.PlaylistDTO) *Playlist {
	spec := playlistkind.Spec{
		Title:    v.Name,
		Interval: v.Interval,
	}
	for _, item := range v.Items {
		spec.Items = append(spec.Items, playlistkind.Item{
			Type:  playlistkind.ItemType(item.Type),
			Value: item.Value,
		})
	}
	return &Playlist{
		TypeMeta: metav1.TypeMeta{
			Kind:       "Playlist",
			APIVersion: APIVersion,
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:              v.Uid,
			UID:               types.UID(v.Uid),
			ResourceVersion:   fmt.Sprintf("%d", v.UpdatedAt),
			CreationTimestamp: metav1.NewTime(time.UnixMilli(v.CreatedAt)),
			Namespace:         fmt.Sprintf("org-%d", v.OrgID),
		},
		Spec: spec,
	}
}
