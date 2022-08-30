package playlist

import (
	"sort"

	"github.com/grafana/grafana/pkg/coremodel/playlist"
)

func (dto PlaylistDTO) Coremodel() playlist.Model {
	items := make([]playlist.Items, len(dto.Items))

	sort.Slice(dto.Items, func(i, j int) bool {
		return dto.Items[i].Order < dto.Items[j].Order
	})
	for _, i := range dto.Items {
		items = append(items, playlist.Items{
			Type:  playlist.ItemsType(i.Type),
			Value: i.Value,
		})
	}

	return playlist.Model{
		Interval: dto.Interval,
		Items:    &items,
		Name:     dto.Name,
		Uid:      dto.UID,
	}
}
