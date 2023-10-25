package v0alpha1

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/playlist"
)

func dtoToK8sResource(v *playlist.PlaylistDTO, namespacer request.NamespaceMapper) Playlist {
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
	return Playlist{
		ObjectMeta: metav1.ObjectMeta{
			Name:              v.Uid,
			UID:               types.UID(v.Uid),
			ResourceVersion:   fmt.Sprintf("%d", v.UpdatedAt),
			CreationTimestamp: metav1.NewTime(time.UnixMilli(v.CreatedAt)),
			Namespace:         namespacer(v.OrgID),
		},
		Spec: spec,
	}
}

// the non-dto object does not include items (useful for table response)
func playlistToK8sResource(v *playlist.Playlist, namespacer request.NamespaceMapper) Playlist {
	return Playlist{
		ObjectMeta: metav1.ObjectMeta{
			Name:              v.UID,
			UID:               types.UID(v.UID),
			ResourceVersion:   fmt.Sprintf("%d", v.UpdatedAt),
			CreationTimestamp: metav1.NewTime(time.UnixMilli(v.CreatedAt)),
			Namespace:         namespacer(v.OrgId),
		},
		Spec: Spec{
			Title:    v.Name,
			Interval: v.Interval,
		},
	}
}
