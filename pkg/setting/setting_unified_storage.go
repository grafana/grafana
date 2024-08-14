package setting

import (
	"strconv"

	"github.com/grafana/grafana/pkg/apiserver/rest"
)

func (cfg *Cfg) setUnifiedStorageConfig() error {
	// read storage configs from ini file
	storageSection := cfg.Raw.Section("unified_storage")
	storageConfig := make(map[string]rest.DualWriterMode)

	// populate the storage config
	for _, k := range storageSection.Keys() {
		v, err := strconv.ParseInt(k.Value(), 10, 32)
		if err != nil {
			return err
		}
		storageConfig[k.Name()] = rest.DualWriterMode(v)
	}
	cfg.UnifiedStorage = storageConfig
	return nil
}
