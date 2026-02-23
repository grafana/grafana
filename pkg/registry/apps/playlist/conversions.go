package playlist

import (
	"encoding/json"
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	playlistv0alpha1 "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v0alpha1"
	playlistv1 "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	playlistsvc "github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/util"
)

func LegacyUpdateCommandToUnstructured(cmd playlistsvc.UpdatePlaylistCommand) unstructured.Unstructured {
	items := make([]map[string]string, 0, len(cmd.Items))
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

func convertToK8sResource(v *playlistsvc.PlaylistDTO, namespacer request.NamespaceMapper) *playlistv0alpha1.Playlist {
	gvk := playlistv1.PlaylistKind().GroupVersionKind()
	return convertToK8sResourceWithVersion(v, namespacer, gvk).(*playlistv1.Playlist)
}

// v0alpha1 and v1 are type aliases, so this can be used for both. the gvk param is only used to set the correct metadata, which is handled by the kind's zerovalue
func convertToK8sResourceWithVersion(v *playlistsvc.PlaylistDTO, namespacer request.NamespaceMapper, gvk schema.GroupVersionKind) runtime.Object {
	spec := playlistv1.PlaylistSpec{
		Title:    v.Name,
		Interval: v.Interval,
	}
	for _, item := range v.Items {
		spec.Items = append(spec.Items, playlistv1.PlaylistItem{
			Type:  playlistv1.PlaylistPlaylistItemType(item.Type),
			Value: item.Value,
		})
	}

	p := &playlistv1.Playlist{
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
			meta.SetDeprecatedInternalID(v.Id) // nolint:staticcheck
		}
	}

	p.UID = gapiutil.CalculateClusterWideUID(p)

	// set the correct TypeMeta based on the requested version
	p.APIVersion = gvk.GroupVersion().String()
	p.Kind = gvk.Kind

	return p
}

// v0alpha1 and v1 are type aliases, so this can be used for both
func convertToLegacyUpdateCommand(obj runtime.Object, orgId int64) (*playlistsvc.UpdatePlaylistCommand, error) {
	p, ok := obj.(*playlistv1.Playlist)
	if !ok {
		return nil, fmt.Errorf("unsupported playlist type: %T", obj)
	}

	spec := p.Spec
	cmd := &playlistsvc.UpdatePlaylistCommand{
		UID:      p.Name,
		Name:     spec.Title,
		Interval: spec.Interval,
		OrgId:    orgId,
	}
	for _, item := range spec.Items {
		if item.Type == playlistv1.PlaylistPlaylistItemTypeDashboardById {
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
	return meta.GetDeprecatedInternalID() // nolint:staticcheck
}
