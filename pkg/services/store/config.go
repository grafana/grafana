package store

import (
	"fmt"
)

type RootStorageConfig struct {
	Type             string `json:"type"`
	Prefix           string `json:"prefix"`
	UnderContentRoot bool   `json:"underContentRoot"`
	Name             string `json:"name"`
	Description      string `json:"description"`
	Disabled         bool   `json:"disabled,omitempty"`

	// Depending on type, these will be configured
	Disk *StorageLocalDiskConfig `json:"disk,omitempty"`
	SQL  *StorageSQLConfig       `json:"sql,omitempty"`
}

type StorageLocalDiskConfig struct {
	Path  string   `json:"path"`
	Roots []string `json:"roots,omitempty"` // null is everything
}

type StorageSQLConfig struct {
	// SQLStorage will prefix all paths with orgId for isolation between orgs
}

func newStorage(cfg RootStorageConfig, _ string) (storageRuntime, error) {
	switch cfg.Type {
	case rootStorageTypeDisk:
		return newDiskStorage(RootStorageMeta{}, cfg), nil
	}

	return nil, fmt.Errorf("unsupported store: %s", cfg.Type)
}
