package setting

import (
	"strings"

	"github.com/grafana/grafana/pkg/apiserver/rest"
)

func (cfg *Cfg) setUnifiedStorageConfig() {
	storageConfig := make(map[string]UnifiedStorageConfig)
	// read storage configs from ini file. They look like:
	// [unified_storage.<resource-name>]
	// config = <value>
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
		storageConfig[resourceName] = UnifiedStorageConfig{DualWriterMode: rest.DualWriterMode(dualWriterMode)}
	}
	cfg.UnifiedStorage = storageConfig
}
