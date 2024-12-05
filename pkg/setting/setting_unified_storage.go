package setting

import (
	"strings"

	"github.com/grafana/grafana/pkg/apiserver/rest"
)

// read storage configs from ini file. They look like:
// [unified_storage.<group>.<resource>]
// <field> = <value>
// e.g.
// [unified_storage.playlists.playlist.grafana.app]
// dualWriterMode = 2
func (cfg *Cfg) setUnifiedStorageConfig() {
	storageConfig := make(map[string]UnifiedStorageConfig)
	sections := cfg.Raw.Sections()
	for _, section := range sections {
		sectionName := section.Name()
		if !strings.HasPrefix(sectionName, "unified_storage.") {
			continue
		}
		// the resource name is the part after the first dot
		resourceName := strings.SplitAfterN(sectionName, ".", 2)[1]

		// parse dualWriter modes from the section
		dualWriterMode := section.Key("dualWriterMode").MustInt(0)

		// parse dualWriter periodic data syncer config
		dualWriterPeriodicDataSyncJobEnabled := section.Key("dualWriterPeriodicDataSyncJobEnabled").MustBool(false)

		storageConfig[resourceName] = UnifiedStorageConfig{
			DualWriterMode:                       rest.DualWriterMode(dualWriterMode),
			DualWriterPeriodicDataSyncJobEnabled: dualWriterPeriodicDataSyncJobEnabled,
		}
	}
	cfg.UnifiedStorage = storageConfig

	// Set indexer config for unified storaae
	section := cfg.Raw.Section("unified_storage")
	cfg.IndexPath = section.Key("index_path").String()
	cfg.IndexWorkers = section.Key("index_workers").MustInt(10)
	cfg.IndexMaxBatchSize = section.Key("index_max_batch_size").MustInt(100)
	cfg.IndexFileThreshold = section.Key("index_file_threshold").MustInt(10)
	cfg.IndexMinCount = section.Key("index_min_count").MustInt(1)
}
