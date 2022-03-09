package store

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/go-git/go-git/v5"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/filestorage"
	"gocloud.dev/blob"
)

const rootStorageTypeGit = "git"

type rootStorageGit struct {
	baseStorageRuntime

	settings *StorageGitConfig
	repo     *git.Repository
}

func newGitStorage(prefix string, name string, localRoot string, cfg *StorageGitConfig) *rootStorageGit {
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
	if len(localRoot) < 2 {
		meta.Notice = append(meta.Notice, data.Notice{
			Severity: data.NoticeSeverityError,
			Text:     "Invalid local root folder",
		})
	} else if _, err := os.Stat(localRoot); os.IsNotExist(err) {
		meta.Notice = append(meta.Notice, data.Notice{
			Severity: data.NoticeSeverityError,
			Text:     "Local root does not exist",
		})
	}

	s := &rootStorageGit{}

	if meta.Notice == nil {
		dir := filepath.Join(localRoot, prefix)
		repo, err := git.PlainOpen(dir)
		if err == git.ErrRepositoryNotExists {
			repo, err = git.PlainClone(dir, false, &git.CloneOptions{
				URL:      cfg.Remote,
				Progress: os.Stdout,
				Depth:    1,
			})
		}

		if err != nil {
			meta.Notice = append(meta.Notice, data.Notice{
				Severity: data.NoticeSeverityError,
				Text:     err.Error(),
			})
		}

		if err == nil {
			p := dir
			if cfg.Root != "" {
				p = filepath.Join(p, cfg.Root)
			}

			path := fmt.Sprintf("file://%s", p)
			bucket, err := blob.OpenBucket(context.Background(), path)
			if err != nil {
				grafanaStorageLogger.Warn("error loading storage", "prefix", prefix, "err", err)
				meta.Notice = append(meta.Notice, data.Notice{
					Severity: data.NoticeSeverityError,
					Text:     "Failed to initalize storage",
				})
			} else {
				s.store = filestorage.NewCdkBlobStorage(
					grafanaStorageLogger,
					bucket, "", nil)

				meta.Ready = true // exists!
			}
		}

		s.repo = repo
	}

	s.meta = meta
	s.settings = cfg
	return s
}

func (s *rootStorageGit) Write(ctx context.Context, cmd *writeCommand) error {
	return fmt.Errorf("not implemented!!!")
}
