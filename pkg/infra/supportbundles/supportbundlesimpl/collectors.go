package supportbundlesimpl

import (
	"context"
	"encoding/json"
	"time"

	"github.com/grafana/grafana/pkg/infra/supportbundles"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/pluginsettings"
	"github.com/grafana/grafana/pkg/setting"
)

func basicCollector(cfg *setting.Cfg) supportbundles.Collector {
	return supportbundles.Collector{
		UID:               "basic",
		DisplayName:       "Basic information",
		Description:       "Basic information about the Grafana instance",
		IncludedByDefault: true,
		Default:           true,
		Fn: func(ctx context.Context) (*supportbundles.SupportItem, error) {
			type basicInfo struct {
				Version string `json:"version"`
				Commit  string `json:"commit"`
			}

			data, err := json.Marshal(basicInfo{
				Version: cfg.BuildVersion,
				Commit:  cfg.BuildCommit,
			})
			if err != nil {
				return nil, err
			}

			return &supportbundles.SupportItem{
				Filename:  "basic.json",
				FileBytes: data,
			}, nil
		},
	}
}

func settingsCollector(settings setting.Provider) supportbundles.Collector {
	return supportbundles.Collector{
		UID:               "settings",
		DisplayName:       "Settings",
		Description:       "Settings for grafana instance",
		IncludedByDefault: false,
		Default:           true,
		Fn: func(ctx context.Context) (*supportbundles.SupportItem, error) {
			current := settings.Current()
			data, err := json.Marshal(current)
			if err != nil {
				return nil, err
			}

			return &supportbundles.SupportItem{
				Filename:  "settings.json",
				FileBytes: data,
			}, nil
		},
	}
}

func usageStatesCollector(stats usagestats.Service) supportbundles.Collector {
	return supportbundles.Collector{
		UID:               "usage-stats",
		DisplayName:       "Usage statistics",
		Description:       "Usage statistic for grafana instance",
		IncludedByDefault: false,
		Default:           true,
		Fn: func(ctx context.Context) (*supportbundles.SupportItem, error) {
			report, err := stats.GetUsageReport(context.Background())
			if err != nil {
				return nil, err
			}

			data, err := json.Marshal(report)
			if err != nil {
				return nil, err
			}
			return &supportbundles.SupportItem{
				Filename:  "usage-stats.json",
				FileBytes: data,
			}, nil
		},
	}
}

func pluginInfoCollector(pluginStore plugins.Store, pluginSettings pluginsettings.Service) supportbundles.Collector {
	return supportbundles.Collector{
		UID:               "plugins",
		DisplayName:       "Plugin information",
		Description:       "Plugin information for grafana instance",
		IncludedByDefault: false,
		Default:           true,
		Fn: func(ctx context.Context) (*supportbundles.SupportItem, error) {
			type pluginInfo struct {
				data  plugins.JSONData
				Class plugins.Class

				// App fields
				IncludedInAppID string
				DefaultNavURL   string
				Pinned          bool

				// Signature fields
				Signature plugins.SignatureStatus

				// SystemJS fields
				Module  string
				BaseURL string

				PluginVersion string
				Enabled       bool
				Updated       time.Time
			}

			plugins := pluginStore.Plugins(context.Background())

			var pluginInfoList []pluginInfo
			for _, plugin := range plugins {
				// skip builtin plugins
				if plugin.BuiltIn {
					continue
				}

				pInfo := pluginInfo{
					data:            plugin.JSONData,
					Class:           plugin.Class,
					IncludedInAppID: plugin.IncludedInAppID,
					DefaultNavURL:   plugin.DefaultNavURL,
					Pinned:          plugin.Pinned,
					Signature:       plugin.Signature,
					Module:          plugin.Module,
					BaseURL:         plugin.BaseURL,
				}

				// TODO need to loop through all the orgs
				// TODO ignore the error for now, not all plugins have settings
				settings, err := pluginSettings.GetPluginSettingByPluginID(context.Background(), &pluginsettings.GetByPluginIDArgs{PluginID: plugin.ID, OrgID: 1})
				if err == nil {
					pInfo.PluginVersion = settings.PluginVersion
					pInfo.Enabled = settings.Enabled
					pInfo.Updated = settings.Updated
				}

				pluginInfoList = append(pluginInfoList, pInfo)
			}

			data, err := json.Marshal(pluginInfoList)
			if err != nil {
				return nil, err
			}
			return &supportbundles.SupportItem{
				Filename:  "plugins.json",
				FileBytes: data,
			}, nil
		},
	}
}
