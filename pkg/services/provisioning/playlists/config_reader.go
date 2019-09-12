package playlists

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v2"

	"github.com/grafana/grafana/pkg/infra/log"
)

type configReader struct {
	log log.Logger
}

func (cr *configReader) readConfig(path string) ([]*playlistsAsConfig, error) {
	var playlists []*playlistsAsConfig
	cr.log.Debug("Looking for playlists provisioning files", "path", path)

	files, err := ioutil.ReadDir(path)
	if err != nil {
		cr.log.Error("Can't read playlists provisioning files from directory", "path", path, "error", err)
		return playlists, nil
	}

	for _, file := range files {
		if strings.HasSuffix(file.Name(), ".yaml") || strings.HasSuffix(file.Name(), ".yml") {
			cr.log.Debug("Parsing playlists provisioning file", "path", path, "file.Name", file.Name())
			p, err := cr.parsePlaylistsConfig(path, file)
			if err != nil {
				return nil, err
			}

			if p != nil {
				playlists = append(playlists, p)
			}
		}
	}

	cr.log.Debug("Validating playlists")
	if err = validateRequiredField(playlists); err != nil {
		return nil, err
	}

	checkOrgIdAndOrgName(playlists)

	return playlists, nil
}

func (cr *configReader) parsePlaylistsConfig(path string, file os.FileInfo) (*playlistsAsConfig, error) {
	filename, _ := filepath.Abs(filepath.Join(path, file.Name()))
	yamlFile, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, err
	}

	var cfg *playlistsAsConfigV0
	err = yaml.Unmarshal(yamlFile, &cfg)
	if err != nil {
		return nil, err
	}

	return cfg.mapToPlaylistsAsConfig(), nil
}

func checkOrgIdAndOrgName(cfgs []*playlistsAsConfig) {
	for _, cfg := range cfgs {
		for _, playlist := range cfg.Playlists {
			if playlist.OrgId < 1 {
				if playlist.OrgName == "" {
					playlist.OrgId = 1
				} else {
					playlist.OrgId = 0
				}
			}
		}

		for _, playlist := range cfg.DeletePlaylists {
			if playlist.OrgId < 1 {
				if playlist.OrgName == "" {
					playlist.OrgId = 1
				} else {
					playlist.OrgId = 0
				}
			}
		}
	}
}

func validateRequiredField(cfgs []*playlistsAsConfig) error {
	for _, cfg := range cfgs {
		var errStrings []string
		for index, playlist := range cfg.Playlists {
			if playlist.Uid == "" {
				errStrings = append(
					errStrings,
					fmt.Sprintf("Added playlist item %d in configuration doesn't contain required field uid", index+1),
				)
			}

			if playlist.Name == "" {
				errStrings = append(
					errStrings,
					fmt.Sprintf("Added playlist item %d in configuration doesn't contain required field name", index+1),
				)
			}

			if playlist.Interval == "" {
				errStrings = append(
					errStrings,
					fmt.Sprintf("Added playlist item %d in configuration doesn't contain required field interval", index+1),
				)
			}

			if len(playlist.Items) == 0 {
				errStrings = append(
					errStrings,
					fmt.Sprintf("Added playlist item %d in configuration has no items", index+1),
				)
			}
		}

		for index, playlist := range cfg.DeletePlaylists {
			if playlist.Uid == "" {
				errStrings = append(
					errStrings,
					fmt.Sprintf("Deleted playlist item %d in configuration doesn't contain required field uid", index+1),
				)
			}
		}

		if len(errStrings) != 0 {
			return fmt.Errorf(strings.Join(errStrings, "\n"))
		}
	}

	return nil
}
