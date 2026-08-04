package playlist

import (
	"encoding/json"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/util"
)

func LegacyUpdateCommandToUnstructured(cmd UpdatePlaylistCommand) unstructured.Unstructured {
	items := make([]any, 0, len(cmd.Items))
	for _, item := range cmd.Items {
		converted := map[string]any{
			"type":  item.Type,
			"value": item.Value,
		}
		if item.Interval != nil {
			converted["interval"] = *item.Interval
		}
		if item.QueryParams != nil {
			converted["queryParams"] = *item.QueryParams
		}
		items = append(items, converted)
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

func PreserveLegacyPlaylistItemOptions(obj *unstructured.Unstructured, existing *unstructured.Unstructured) {
	items, found, err := unstructured.NestedSlice(obj.Object, "spec", "items")
	if err != nil || !found {
		return
	}
	existingItems, found, err := unstructured.NestedSlice(existing.Object, "spec", "items")
	if err != nil || !found {
		return
	}

	used := make([]bool, len(existingItems))
	for _, item := range items {
		itemMap, ok := item.(map[string]any)
		if !ok {
			continue
		}
		for i, existingItem := range existingItems {
			if used[i] {
				continue
			}
			existingMap, ok := existingItem.(map[string]any)
			if !ok || itemMap["type"] != existingMap["type"] || itemMap["value"] != existingMap["value"] {
				continue
			}
			used[i] = true
			for _, field := range []string{"interval", "queryParams"} {
				if _, supplied := itemMap[field]; supplied {
					continue
				}
				if value, exists := existingMap[field]; exists {
					itemMap[field] = value
				}
			}
			break
		}
	}

	_ = unstructured.SetNestedSlice(obj.Object, items, "spec", "items")
}

func UnstructuredToLegacyPlaylist(item unstructured.Unstructured) *Playlist {
	spec := item.Object["spec"].(map[string]any)
	return &Playlist{
		UID:      item.GetName(),
		Name:     spec["title"].(string),
		Interval: spec["interval"].(string),
		Id:       getLegacyID(&item),
	}
}

func UnstructuredToLegacyPlaylistDTO(item unstructured.Unstructured) *PlaylistDTO {
	spec := item.Object["spec"].(map[string]any)
	dto := &PlaylistDTO{
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

// Read legacy ID from metadata annotations
func getLegacyID(item *unstructured.Unstructured) int64 {
	meta, err := utils.MetaAccessor(item)
	if err != nil {
		return 0
	}
	return meta.GetDeprecatedInternalID() // nolint:staticcheck
}
