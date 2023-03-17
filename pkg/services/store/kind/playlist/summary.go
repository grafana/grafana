package playlist

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/kinds/playlist"
	"github.com/grafana/grafana/pkg/services/store/entity"
)

func GetEntityKindInfo() entity.EntityKindInfo {
	return entity.EntityKindInfo{
		ID:          entity.StandardKindPlaylist,
		Name:        "Playlist",
		Description: "Cycle though a collection of dashboards automatically",
	}
}

func GetEntitySummaryBuilder() entity.EntitySummaryBuilder {
	return summaryBuilder
}

func summaryBuilder(ctx context.Context, uid string, body []byte) (*entity.EntitySummary, []byte, error) {
	obj := &playlist.Playlist{}
	err := json.Unmarshal(body, obj)
	if err != nil {
		return nil, nil, err // unable to read object
	}

	// TODO: fix model so this is not possible
	if obj.Spec.Items == nil {
		temp := make([]playlist.SpecPlaylistItem, 0)
		obj.Spec.Items = temp
	}

	obj.Spec.Uid = uid // make sure they are consistent
	summary := &entity.EntitySummary{
		UID:         uid,
		Name:        obj.Spec.Name,
		Description: fmt.Sprintf("%d items, refreshed every %s", len(obj.Spec.Items), obj.Spec.Interval),
	}

	for _, item := range obj.Spec.Items {
		switch item.Type {
		case playlist.SpecPlaylistItemTypeDashboardByUid:
			summary.References = append(summary.References, &entity.EntityExternalReference{
				Family:     entity.StandardKindDashboard,
				Identifier: item.Value,
			})

		case playlist.SpecPlaylistItemTypeDashboardByTag:
			if summary.Labels == nil {
				summary.Labels = make(map[string]string, 0)
			}
			summary.Labels[item.Value] = ""

		case playlist.SpecPlaylistItemTypeDashboardById:
			// obviously insufficient long term... but good to have an example :)
			summary.Error = &entity.EntityErrorInfo{
				Message: "Playlist uses deprecated internal id system",
			}
		}
	}

	out, err := json.MarshalIndent(obj, "", "  ")
	return summary, out, err
}
