package playlists

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
)

func Provision(configDirectory string) error {
	dc := newPlaylistProvisioner(log.New("provisioning.playlists"))
	return dc.applyChanges(configDirectory)
}

type PlaylistProvisioner struct {
	log       log.Logger
	cfgReader *configReader
}

func newPlaylistProvisioner(log log.Logger) PlaylistProvisioner {
	return PlaylistProvisioner{
		log:       log,
		cfgReader: &configReader{log: log},
	}
}

func (dc *PlaylistProvisioner) applyChanges(configPath string) error {
	configs, err := dc.cfgReader.readConfig(configPath)
	if err != nil {
		return err
	}

	for _, cfg := range configs {
		if err := dc.apply(cfg); err != nil {
			return err
		}
	}

	return nil
}

func (dc *PlaylistProvisioner) apply(cfg *playlistsAsConfig) error {
	if err := dc.deletePlaylists(cfg.DeletePlaylists); err != nil {
		return err
	}

	if err := dc.mergePlaylists(cfg.Playlists); err != nil {
		return err
	}

	return nil
}

func (dc *PlaylistProvisioner) deletePlaylists(playlistsToDelete []*deletePlaylistConfig) error {
	for _, playlist := range playlistsToDelete {
		if playlist.OrgId == 0 && playlist.OrgName != "" {
			getOrg := &models.GetOrgByNameQuery{Name: playlist.OrgName}
			if err := bus.Dispatch(getOrg); err != nil {
				return err
			}
			playlist.OrgId = getOrg.Result.Id
		} else if playlist.OrgId < 0 {
			playlist.OrgId = 1
		}

		getPlaylist := &models.GetPlaylistByUidQuery{Uid: playlist.Uid, OrgId: playlist.OrgId}

		if err := bus.Dispatch(getPlaylist); err != nil {
			return err
		}

		if getPlaylist.Result != nil {
			dc.log.Debug("deleting playlist from configuration", "orgId", getPlaylist.Result.OrgId, "uid", getPlaylist.Result.Uid)

			cmd := &models.DeletePlaylistWithUidCommand{Uid: getPlaylist.Result.Uid, OrgId: getPlaylist.Result.OrgId}
			if err := bus.Dispatch(cmd); err != nil {
				return err
			}
		}
	}
	return nil
}

func (dc *PlaylistProvisioner) mergePlaylists(playlistsToMerge []*playlistFromConfig) error {
	for _, playlist := range playlistsToMerge {
		if playlist.OrgId == 0 && playlist.OrgName != "" {
			getOrg := &models.GetOrgByNameQuery{Name: playlist.OrgName}
			if err := bus.Dispatch(getOrg); err != nil {
				return err
			}
			playlist.OrgId = getOrg.Result.Id
		} else if playlist.OrgId < 0 {
			playlist.OrgId = 1
		}

		cmd := &models.GetPlaylistByUidQuery{OrgId: playlist.OrgId, Uid: playlist.Uid}
		err := bus.Dispatch(cmd)
		if err != nil {
			return err
		}

		if cmd.Result == nil {
			dc.log.Debug("inserting playlist from configuration", "name", playlist.Name, "orgId", playlist.OrgId, "uid", playlist.Uid)
			insertCmd := &models.CreatePlaylistCommand{
				OrgId:    playlist.OrgId,
				Uid:      playlist.Uid,
				Name:     playlist.Name,
				Interval: playlist.Interval,
				Items:    []models.PlaylistItemDTO{},
			}
			for _, item := range playlist.Items {
				insertCmd.Items = append(insertCmd.Items, models.PlaylistItemDTO{
					Type:  item.Type,
					Title: item.Title,
					Value: item.Value,
					Order: item.Order,
				})
			}

			if err := bus.Dispatch(insertCmd); err != nil {
				return err
			}
		} else {
			dc.log.Debug("updating playlist from configuration", "name", playlist.Name, "orgId", playlist.OrgId, "uid", playlist.Uid)
			updateCmd := &models.UpdatePlaylistWithUidCommand{
				OrgId:    playlist.OrgId,
				Uid:      playlist.Uid,
				Name:     playlist.Name,
				Interval: playlist.Interval,
				Items:    []models.PlaylistItemDTO{},
			}
			for _, item := range playlist.Items {
				updateCmd.Items = append(updateCmd.Items, models.PlaylistItemDTO{
					Type:  item.Type,
					Title: item.Title,
					Value: item.Value,
					Order: item.Order,
				})
			}

			if err := bus.Dispatch(updateCmd); err != nil {
				return err
			}
		}
	}

	return nil
}
