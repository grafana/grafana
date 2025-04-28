package setting

import (
	"strings"
	"time"

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

		// parse dualWriter migration data sync disabled from resource section
		dualWriterMigrationDataSyncDisabled := section.Key("dualWriterMigrationDataSyncDisabled").MustBool(false)

		// parse dataSyncerRecordsLimit from resource section
		dataSyncerRecordsLimit := section.Key("dataSyncerRecordsLimit").MustInt(1000)

		// parse dataSyncerInterval from resource section
		dataSyncerInterval := section.Key("dataSyncerInterval").MustDuration(time.Hour)

		storageConfig[resourceName] = UnifiedStorageConfig{
			DualWriterMode:                       rest.DualWriterMode(dualWriterMode),
			DualWriterPeriodicDataSyncJobEnabled: dualWriterPeriodicDataSyncJobEnabled,
			DualWriterMigrationDataSyncDisabled:  dualWriterMigrationDataSyncDisabled,
			DataSyncerRecordsLimit:               dataSyncerRecordsLimit,
			DataSyncerInterval:                   dataSyncerInterval,
		}
	}
	cfg.UnifiedStorage = storageConfig

	// Set indexer config for unified storaae
	section := cfg.Raw.Section("unified_storage")
	cfg.IndexPath = section.Key("index_path").String()
	cfg.IndexWorkers = section.Key("index_workers").MustInt(10)
	cfg.IndexMaxBatchSize = section.Key("index_max_batch_size").MustInt(100)
	cfg.EnableSharding = section.Key("enable_sharding").MustBool(false)
	cfg.MemberlistBindAddr = section.Key("memberlist_bind_addr").String()
	cfg.MemberlistAdvertiseAddr = section.Key("memberlist_advertise_addr").String()
	cfg.MemberlistJoinMember = section.Key("memberlist_join_member").String()
	cfg.InstanceID = section.Key("instance_id").String()
	cfg.IndexFileThreshold = section.Key("index_file_threshold").MustInt(10)
	cfg.IndexMinCount = section.Key("index_min_count").MustInt(1)
	cfg.SprinklesApiServer = section.Key("sprinkles_api_server").String()
	cfg.SprinklesApiServerPageLimit = section.Key("sprinkles_api_server_page_limit").MustInt(100)
	cfg.CACertPath = section.Key("ca_cert_path").String()
	cfg.HttpsSkipVerify = section.Key("https_skip_verify").MustBool(false)
}
