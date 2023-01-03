package supportbundlesimpl

import (
	"context"
	"encoding/json"
	"fmt"
	"runtime"
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

			data, err := json.Marshal(basicInfo{
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
