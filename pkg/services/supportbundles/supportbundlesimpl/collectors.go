package supportbundlesimpl

import (
	"context"
	"encoding/json"
	"fmt"
	"runtime"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/supportbundles"
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
				Version         string    `json:"version"`          // Version is the version of Grafana instance.
				Commit          string    `json:"commit"`           // Commit is the commit hash of the Grafana instance.
				CollectionDate  time.Time `json:"collection_date"`  // CollectionDate is the date when the support bundle was created.
				DefaultTimezone string    `json:"default_timezone"` // DefaultTimezone is the default timezone of the Grafana instance.
				Alloc           uint64    `json:"alloc"`            // Alloc is bytes of allocated heap objects.
				TotalAlloc      uint64    `json:"total_alloc"`      // TotalAlloc is cumulative bytes allocated for heap objects.
				Sys             uint64    `json:"sys"`              // Sys is the total bytes of memory obtained from the OS.
				Mallocs         uint64    `json:"mallocs"`          // Mallocs is the cumulative count of heap objects allocated.
				Frees           uint64    `json:"frees"`            // Frees is the cumulative count of heap objects freed.
				NumGC           uint32    `json:"num_gc"`           // NumGC is the number of completed GC cycles.
				PauseTotalNs    uint64    `json:"pause_total_ns"`   // PauseTotalNs is the cumulative nanoseconds in GC
				NumCPU          int       `json:"num_cpu"`          // NumCPU is the number of logical CPUs usable by the current process.
				NumGoRoutines   int       `json:"num_go_routines"`  // NumGoRoutines is the number of goroutines that currently exist.
				GoVersion       string    `json:"go_version"`       // GoVersion is the version of Go used to build the binary.
				GoOS            string    `json:"go_os"`            // GoOS is the operating system target used to build the binary.
				GoArch          string    `json:"go_arch"`          // GoArch is the architecture target used to build the binary.
				GoCompiler      string    `json:"go_compiler"`      // GoCompiler is the compiler used to build the binary.
			}

			memstats := runtime.MemStats{}
			runtime.ReadMemStats(&memstats)

			collectionDate := time.Now()
			tz, offset := collectionDate.Zone()

			loc, _ := time.LoadLocation("UTC")
			now := collectionDate.In(loc)

			info := basicInfo{
				Version:         cfg.BuildVersion,
				Commit:          cfg.BuildCommit,
				CollectionDate:  now,
				DefaultTimezone: fmt.Sprintf("%s (UTC%+d)", tz, offset/60/60),
				Alloc:           memstats.Alloc,
				TotalAlloc:      memstats.TotalAlloc,
				Sys:             memstats.Sys,
				Mallocs:         memstats.Mallocs,
				Frees:           memstats.Frees,
				NumGC:           memstats.NumGC,
				PauseTotalNs:    memstats.PauseTotalNs,
				NumCPU:          runtime.NumCPU(),
				NumGoRoutines:   runtime.NumGoroutine(),
				GoVersion:       runtime.Version(),
				GoOS:            runtime.GOOS,
				GoArch:          runtime.GOARCH,
				GoCompiler:      runtime.Compiler,
			}
			data, err := json.MarshalIndent(info, "", " ")
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
		Description:       "Settings of the Grafana instance",
		IncludedByDefault: false,
		Default:           true,
		Fn: func(ctx context.Context) (*supportbundles.SupportItem, error) {
			current := settings.Current()
			data, err := json.MarshalIndent(current, "", " ")
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

func pluginInfoCollector(pluginStore plugins.Store, pluginSettings pluginsettings.Service, logger log.Logger) supportbundles.Collector {
	return supportbundles.Collector{
		UID:               "plugins",
		DisplayName:       "Plugin information",
		Description:       "Plugin information for the Grafana instance",
		IncludedByDefault: false,
		Default:           true,
		Fn: func(ctx context.Context) (*supportbundles.SupportItem, error) {
			type PluginInfo struct {
				id          string
				Name        string
				Description string
				PluginType  string `json:"type"`

				Author          plugins.InfoLink `json:"author,omitempty"`
				SignatureStatus plugins.SignatureStatus
				SignatureType   plugins.SignatureType
				SignatureOrg    string

				GrafanaVersionDependency string `json:"grafanaVersionDependency,omitempty"`

				Settings []pluginsettings.InfoDTO `json:"settings,omitempty"`
			}

			// plugin definitions
			plugins := pluginStore.Plugins(ctx)

			// plugin settings
			settings, err := pluginSettings.GetPluginSettings(ctx, &pluginsettings.GetArgs{})
			if err != nil {
				logger.Debug("failed to fetch plugin settings:", "err", err)
			}

			settingMap := make(map[string][]*pluginsettings.InfoDTO)
			for _, ps := range settings {
				settingMap[ps.PluginID] = append(settingMap[ps.PluginID], ps)
			}

			var pluginInfoList []PluginInfo
			for _, plugin := range plugins {
				// skip builtin and core plugins
				if plugin.BuiltIn || plugin.IsCorePlugin() {
					continue
				}
				// skip plugins that are included in another plugin
				if plugin.IncludedInAppID != "" {
					continue
				}

				pInfo := PluginInfo{
					id:                       plugin.ID,
					Name:                     plugin.Name,
					Description:              plugin.Info.Description,
					PluginType:               string(plugin.Type),
					Author:                   plugin.Info.Author,
					SignatureStatus:          plugin.Signature,
					SignatureType:            plugin.SignatureType,
					SignatureOrg:             plugin.SignatureOrg,
					GrafanaVersionDependency: plugin.Dependencies.GrafanaVersion,
				}

				for _, ps := range settingMap[plugin.ID] {
					pInfo.Settings = append(pInfo.Settings, pluginsettings.InfoDTO{
						OrgID:         ps.OrgID,
						Enabled:       ps.Enabled,
						PluginVersion: ps.PluginVersion,
					})
				}

				pluginInfoList = append(pluginInfoList, pInfo)
			}

			data, err := json.MarshalIndent(pluginInfoList, "", " ")
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
