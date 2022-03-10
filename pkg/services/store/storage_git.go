package store

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
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
	hash     string

	github *githubHelper
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
				//Depth:    1,
				//SingleBranch: true,
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
					Text:     "Failed to initialize storage",
				})
			} else {
				s.store = filestorage.NewCdkBlobStorage(
					grafanaStorageLogger,
					bucket, "", nil)

				meta.Ready = true // exists!
				s.root = dir

				token := cfg.AccessToken
				if strings.HasPrefix(token, "$") {
					token = os.Getenv(token[1:])
					if token == "" {
						meta.Notice = append(meta.Notice, data.Notice{
							Severity: data.NoticeSeverityError,
							Text:     "Unable to find token environment variable: " + token,
						})
					}
				}

				if token != "" {
					s.github, err = newGithubHelper(context.Background(), cfg.Remote, token)
					if err != nil {
						meta.Notice = append(meta.Notice, data.Notice{
							Severity: data.NoticeSeverityError,
							Text:     "error creating github client: " + err.Error(),
						})
						s.github = nil
					} else {
						ghrepo, _, err := s.github.getRepo(context.Background())
						if err != nil {
							meta.Notice = append(meta.Notice, data.Notice{
								Severity: data.NoticeSeverityError,
								Text:     err.Error(),
							})
							s.github = nil
						} else {
							grafanaStorageLogger.Info("default branch", "branch", *ghrepo.DefaultBranch)
						}
					}
				}
			}
		}
		s.repo = repo

		// Try pulling after init
		if s.repo != nil {
			err = s.Pull()
			if err != nil {
				meta.Notice = append(meta.Notice, data.Notice{
					Severity: data.NoticeSeverityError,
					Text:     "unable to pull: " + err.Error(),
				})
			}
		}
	}

	s.meta = meta
	s.settings = cfg
	return s
}

func (s *rootStorageGit) Pull() error {
	w, err := s.repo.Worktree()
	if err != nil {
		return err
	}

	err = w.Pull(&git.PullOptions{
		// Depth: 1,
		//SingleBranch: true,
	})
	if err != nil {
		return err
	}
	return nil
}

func (s *rootStorageGit) Write(ctx context.Context, cmd *WriteValueRequest) (*WriteValueResponse, error) {
	if s.github == nil {
		return nil, fmt.Errorf("github client not initialized")
	}
	// Write to the correct subfolder
	if s.settings.Root != "" {
		cmd.Path = s.settings.Root + "/" + cmd.Path
	}

	if cmd.Action == "pr" {
		prcmd := makePRCommand{
			baseBranch: s.settings.Branch,
			headBranch: fmt.Sprintf("grafana_ui_%d", time.Now().UnixMilli()),
			title:      cmd.Title,
			body:       cmd.Message,
		}
		res := &WriteValueResponse{
			Branch: prcmd.headBranch,
		}

		ref, _, err := s.github.createRef(ctx, prcmd.baseBranch, prcmd.headBranch)
		if err != nil {
			res.Code = 500
			res.Message = "unable to create branch"
			return res, nil
		}

		err = s.github.pushCommit(ctx, ref, cmd)
		if err != nil {
			res.Code = 500
			res.Message = "error creating commit"
			return res, nil
		}

		if prcmd.title == "" {
			prcmd.title = "Dashboard save: " + time.Now().String()
		}
		if prcmd.body == "" {
			prcmd.body = "Dashboard save: " + time.Now().String()
		}

		pr, _, err := s.github.createPR(ctx, prcmd)
		if err != nil {
			res.Code = 500
			res.Message = "error creating PR: " + err.Error()
			return res, nil
		}

		res.Code = 200
		res.URL = pr.GetHTMLURL()
		res.Pending = true
		res.Hash = *ref.Object.SHA
		res.Branch = prcmd.headBranch
		return res, nil
	}

	// Commit to main
	if true {
		res := &WriteValueResponse{
			Branch: s.settings.Branch,
		}
		ref, _, err := s.github.getRef(ctx, s.settings.Branch)
		if err != nil {
			res.Code = 500
			res.Message = "unable to create branch"
			return res, nil
		}
		err = s.github.pushCommit(ctx, ref, cmd)
		if err != nil {
			res.Code = 500
			res.Message = "error creating commit"
			return res, nil
		}
		ref, _, _ = s.github.getRef(ctx, s.settings.Branch)
		if ref != nil {
			res.Hash = *ref.Object.SHA
			res.URL = ref.GetURL()
		}

		err = s.Pull()
		if err != nil {
			res.Message = "error pulling: " + err.Error()
		}

		res.Code = 200
		return res, nil
	}

	rel := cmd.Path
	if s.meta.Config.Git.Root != "" {
		rel = filepath.Join(s.meta.Config.Git.Root, cmd.Path)
	}

	fpath := filepath.Join(s.root, rel)
	err := os.WriteFile(fpath, cmd.Body, 0644)
	if err != nil {
		return nil, err
	}

	w, err := s.repo.Worktree()
	if err != nil {
		return nil, err
	}

	// The file we just wrote
	_, err = w.Add(rel)
	if err != nil {
		return nil, err
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
	if err != nil {
		return nil, err
	}

	grafanaStorageLogger.Info("made commit", "hash", hash)
	// err = s.repo.Push(&git.PushOptions{
	// 	InsecureSkipTLS: true,
	// })

	return &WriteValueResponse{
		Hash:    hash.String(),
		Message: "made commit",
	}, nil
}
