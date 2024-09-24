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
}
