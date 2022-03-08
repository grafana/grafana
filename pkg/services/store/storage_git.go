package store

import (
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

const rootStorageTypeGit = "git"

type rootStorageGit struct {
	baseStorageRuntime

	settings *StorageGitConfig
}

func newGitStorage(prefix string, name string, cfg *StorageGitConfig) *rootStorageGit {
	if cfg == nil {
		cfg = &StorageGitConfig{}
	}

	meta := RootStorageMeta{
		Config: RootStorageConfig{
			Type:   rootStorageTypeGit,
			Prefix: prefix,
			Name:   name,
			Git:    cfg,
		},
	}
	if prefix == "" {
		meta.Notice = append(meta.Notice, data.Notice{
			Severity: data.NoticeSeverityError,
			Text:     "Missing prefix",
		})
	}
	if cfg.Remote == "" {
		meta.Notice = append(meta.Notice, data.Notice{
			Severity: data.NoticeSeverityError,
			Text:     "Missing remote path configuration",
		})
	}
	s := &rootStorageGit{}

	if meta.Notice == nil {
		meta.Notice = append(meta.Notice, data.Notice{
			Severity: data.NoticeSeverityError,
			Text:     "not impemented yet...",
		})
	}

	s.meta = meta
	s.settings = cfg
	return s
}
