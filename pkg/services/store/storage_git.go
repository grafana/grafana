package store

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"gocloud.dev/blob"

	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

const rootStorageTypeGit = "git"

var _ storageRuntime = &rootStorageGit{}

type rootStorageGit struct {
	settings *StorageGitConfig
	repo     *git.Repository
	root     string // repostitory root

	github *githubHelper
	meta   RootStorageMeta
	store  filestorage.FileStorage
}

func newGitStorage(meta RootStorageMeta, scfg RootStorageConfig, localWorkCache string) *rootStorageGit {
	cfg := scfg.Git
	if cfg == nil {
		cfg = &StorageGitConfig{}
	}
	scfg.Type = rootStorageTypeGit
	scfg.GCS = nil
	scfg.SQL = nil
	scfg.S3 = nil
	scfg.Git = cfg

	meta.Config = scfg
	if scfg.Prefix == "" {
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

	if len(localWorkCache) < 2 {
		meta.Notice = append(meta.Notice, data.Notice{
			Severity: data.NoticeSeverityError,
			Text:     "Invalid local root folder",
		})
	}

	s := &rootStorageGit{
		settings: cfg,
	}
	if meta.Notice == nil {
		err := os.MkdirAll(localWorkCache, 0750)
		if err != nil {
			meta.Notice = append(meta.Notice, data.Notice{
				Severity: data.NoticeSeverityError,
				Text:     err.Error(),
			})
		}
	}

	if scfg.Disabled {
		meta.Notice = append(meta.Notice, data.Notice{
			Severity: data.NoticeSeverityWarning,
			Text:     "folder is disabled (in configuration)",
		})
	} else if setting.Env == setting.Prod {
		meta.Notice = append(meta.Notice, data.Notice{
			Severity: data.NoticeSeverityError,
			Text:     "git is only supported in dev mode (for now)",
		})
	}

	if meta.Notice == nil {
		repo, err := git.PlainOpen(localWorkCache)
		if errors.Is(err, git.ErrRepositoryNotExists) {
			repo, err = git.PlainClone(localWorkCache, false, &git.CloneOptions{
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
			p := localWorkCache
			if cfg.Root != "" {
				p = filepath.Join(p, cfg.Root)
			}

			path := fmt.Sprintf("file://%s", p)
			bucket, err := blob.OpenBucket(context.Background(), path)
			if err != nil {
				grafanaStorageLogger.Warn("error loading storage", "prefix", scfg.Prefix, "err", err)
				meta.Notice = append(meta.Notice, data.Notice{
					Severity: data.NoticeSeverityError,
					Text:     "Failed to initialize storage",
				})
			} else {
				s.store = filestorage.NewCdkBlobStorage(
					grafanaStorageLogger,
					bucket, "", nil)

				meta.Ready = true // exists!
				s.root = p

				token := cfg.AccessToken
				if strings.HasPrefix(token, "$") {
					token = os.Getenv(token[1:])
					if token == "" {
						meta.Notice = append(meta.Notice, data.Notice{
							Severity: data.NoticeSeverityError,
							Text:     "Unable to find token environment variable: " + cfg.AccessToken,
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
		if s.repo != nil && !scfg.Disabled {
			err = s.Sync()
			if err != nil {
				meta.Notice = append(meta.Notice, data.Notice{
					Severity: data.NoticeSeverityError,
					Text:     "unable to pull: " + err.Error(),
				})
			} else if cfg.PullInterval != "" {
				t, err := time.ParseDuration(cfg.PullInterval)
				if err != nil {
					meta.Notice = append(meta.Notice, data.Notice{
						Severity: data.NoticeSeverityError,
						Text:     "Invalid pull interval " + cfg.PullInterval,
					})
				} else {
					ticker := time.NewTicker(t)
					go func() {
						for range ticker.C {
							grafanaStorageLogger.Info("try git pull", "branch", s.settings.Remote)
							err = s.Sync()
							if err != nil {
								grafanaStorageLogger.Info("error pulling", "error", err)
							}
						}
					}()
				}
			}
		}
	}

	s.meta = meta
	return s
}

func (s *rootStorageGit) Meta() RootStorageMeta {
	return s.meta
}

func (s *rootStorageGit) Store() filestorage.FileStorage {
	return s.store
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
		cmd.Path = s.settings.Root + cmd.Path
	}

	if cmd.Workflow == WriteValueWorkflow_PR {
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
			res.Message = fmt.Sprintf("error creating commit: %s", err.Error())
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

	// Push to remote branch (save)
	if cmd.Workflow == WriteValueWorkflow_Push || true {
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
	usr := cmd.User
	if usr == nil {
		usr = &user.SignedInUser{}
	}

	hash, err := w.Commit(msg, &git.CommitOptions{
		Author: &object.Signature{
			Name:  firstRealString(usr.Name, usr.Login, usr.Email, "?"),
			Email: firstRealString(usr.Email, usr.Login, usr.Name, "?"),
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

func (s *rootStorageGit) Sync() error {
	grafanaStorageLogger.Info("GIT PULL", "remote", s.settings.Remote)
	err := s.Pull()
	if err != nil {
		if err.Error() == "already up-to-date" {
			return nil
		}
	}
	return err
}

func firstRealString(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return "?"
}
