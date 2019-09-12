package playlists

import (
	"github.com/grafana/grafana/pkg/services/provisioning/values"
)

// playlistsAsConfig is normalized data object for playlists config data.
// Any config version should be mappable to this type.
type playlistsAsConfig struct {
	Playlists       []*playlistFromConfig
	DeletePlaylists []*deletePlaylistConfig
}

type playlistFromConfig struct {
	OrgId    int64
	OrgName  string
	Uid      string
	Name     string
	Interval string
	Items    []*playlistItemFromConfig
}

type playlistItemFromConfig struct {
	Type  string
	Value string
	Order int
	Title string
}

type deletePlaylistConfig struct {
	OrgId   int64
	OrgName string
	Uid     string
}

// Version 0

// playlistsAsConfigV0 is mapping for version 0. This is mapped to its normalised version.
type playlistsAsConfigV0 struct {
	Playlists       []*playlistFromConfigV0   `json:"playlists" yaml:"playlists"`
	DeletePlaylists []*deletePlaylistConfigV0 `json:"delete_playlists" yaml:"delete_playlists"`
}

type playlistFromConfigV0 struct {
	OrgId    values.Int64Value           `json:"org_id" yaml:"org_id"`
	OrgName  values.StringValue          `json:"org_name" yaml:"org_name"`
	Uid      values.StringValue          `json:"uid" yaml:"uid"`
	Name     values.StringValue          `json:"name" yaml:"name"`
	Interval values.StringValue          `json:"interval" yaml:"interval"`
	Items    []*playlistItemFromConfigV0 `json:"items" yaml:"items"`
}

type playlistItemFromConfigV0 struct {
	Type  values.StringValue `json:"type" yaml:"type"`
	Value values.StringValue `json:"value" yaml:"value"`
	Order values.IntValue    `json:"order" yaml:"order"`
	Title values.StringValue `json:"title" yaml:"title"`
}

type deletePlaylistConfigV0 struct {
	OrgId   values.Int64Value  `json:"org_id" yaml:"org_id"`
	OrgName values.StringValue `json:"org_name" yaml:"org_name"`
	Uid     values.StringValue `json:"uid" yaml:"uid"`
}

func (cfg *playlistsAsConfigV0) mapToPlaylistsAsConfig() *playlistsAsConfig {
	r := &playlistsAsConfig{}
	if cfg == nil {
		return r
	}

	for _, playlist := range cfg.Playlists {
		items := []*playlistItemFromConfig{}
		for _, item := range playlist.Items {
			items = append(items, &playlistItemFromConfig{
				Type:  item.Type.Value(),
				Value: item.Value.Value(),
				Order: item.Order.Value(),
				Title: item.Title.Value(),
			})
		}

		r.Playlists = append(r.Playlists, &playlistFromConfig{
			OrgId:    playlist.OrgId.Value(),
			OrgName:  playlist.OrgName.Value(),
			Uid:      playlist.Uid.Value(),
			Name:     playlist.Name.Value(),
			Interval: playlist.Interval.Value(),
			Items:    items,
		})
	}

	for _, playlist := range cfg.DeletePlaylists {
		r.DeletePlaylists = append(r.DeletePlaylists, &deletePlaylistConfig{
			OrgId:   playlist.OrgId.Value(),
			OrgName: playlist.OrgName.Value(),
			Uid:     playlist.Uid.Value(),
		})
	}

	return r
}
