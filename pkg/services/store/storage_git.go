package store

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing/object"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/models"
	"gocloud.dev/blob"
)

const rootStorageTypeGit = "git"

type rootStorageGit struct {
	baseStorageRuntime

	settings *StorageGitConfig
	repo     *git.Repository
	root     string // repostitory root

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
				s.root = dir
			}
		}

		s.repo = repo
	}

	s.meta = meta
	s.settings = cfg
	return s
}

func (s *rootStorageGit) Write(ctx context.Context, cmd *writeCommand) error {
	rel := cmd.Path
	if s.meta.Config.Git.Root != "" {
		rel = filepath.Join(s.meta.Config.Git.Root, cmd.Path)
	}

	fpath := filepath.Join(s.root, rel)
	err := os.WriteFile(fpath, cmd.Body, 0644)
	if err != nil {
		return err
	}

	w, err := s.repo.Worktree()
	if err != nil {
		return err
	}

	// The file we just wrote
	_, err = w.Add(rel)
	if err != nil {
		return err
	}

	msg := cmd.Message
	if msg == "" {
		msg = "changes from grafana ui"
	}
	user := cmd.User
	if user == nil {
		user = &models.SignedInUser{}
	}

	hash, err := w.Commit(msg, &git.CommitOptions{
		Author: &object.Signature{
			Name:  firstRealString(user.Name, user.Login, user.Email, "?"),
			Email: firstRealString(user.Email, user.Login, user.Name, "?"),
			When:  time.Now(),
		},
	})

	grafanaStorageLogger.Info("made commit", "hash", hash)

	//
	err = s.repo.Push(&git.PushOptions{
		InsecureSkipTLS: true,
	})

	return err
}
