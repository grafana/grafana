package gogit

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/go-git/go-billy/v5/util"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing/object"
	githttp "github.com/go-git/go-git/v5/plumbing/transport/http"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

var (
	_ repository.Repository = (*GoGitRepo)(nil)
)

type BufferedRepository interface {
	repository.Repository

	Checkout(ctx context.Context, ref string, create string) error
	Push(ctx context.Context) error
}

type GoGitRepo struct {
	config *provisioning.Repository

	repo *git.Repository
	tree *git.Worktree
	dir  string // file path to worktree root (necessary? should use billy)
}

func Clone(
	ctx context.Context,
	config *provisioning.Repository,
	root string, // tempdir (when empty, memory??)
	progress io.Writer, // os.Stdout
) (*GoGitRepo, error) {
	gitcfg := config.Spec.GitHub
	if gitcfg == nil {
		return nil, fmt.Errorf("missing github config")
	}
	dir, err := getRepoFolder(root, config)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("https://github.com/%s/%s.git", gitcfg.Owner, gitcfg.Repository)

	repo, err := git.PlainOpen(dir)
	if err != nil {
		if !errors.Is(err, git.ErrRepositoryNotExists) {
			return nil, fmt.Errorf("error opening repository %w", err)
		}

		repo, err = git.PlainCloneContext(ctx, dir, false, &git.CloneOptions{
			Auth: &githttp.BasicAuth{
				Username: "grafana",    // this can be anything except an empty string for PAT
				Password: gitcfg.Token, // TODO... will need to get from a service!
			},
			URL:      url,
			Progress: progress,
		})
		if err != nil {
			return nil, fmt.Errorf("clone error %w", err)
		}
	}

	rcfg, err := repo.Config()
	if err != nil {
		return nil, fmt.Errorf("error readign repository config %w", err)
	}

	origin := rcfg.Remotes["origin"]
	if origin == nil {
		return nil, fmt.Errorf("missing origin remote %w", err)
	}
	if url != origin.URLs[0] {
		return nil, fmt.Errorf("unexpected remote (expected:%s, found: %s)", url, origin.URLs[0])
	}

	worktree, err := repo.Worktree()
	if err != nil {
		return nil, err
	}
	// err = worktree.Checkout(&git.CheckoutOptions{
	// 	Branch: plumbing.ReferenceName(gitcfg.Branch),
	// 	Force:  true, // clear any local changes
	// })
	// if err != nil {
	// 	return nil, err
	// }

	return &GoGitRepo{
		config: config,
		tree:   worktree,
		repo:   repo,
		dir:    dir,
	}, nil
}

func getRepoFolder(root string, config *provisioning.Repository) (string, error) {
	if config.Namespace == "" {
		return "", fmt.Errorf("config is missing namespace")
	}
	if config.Name == "" {
		return "", fmt.Errorf("config is missing name")
	}
	bytes, err := json.Marshal(config.Spec)
	if err != nil {
		return "", err
	}
	h := sha256.New()
	_, err = h.Write(bytes)
	if err != nil {
		return "", err
	}
	hashstring := hex.EncodeToString(h.Sum(nil))
	dir := filepath.Join(root, config.Namespace, fmt.Sprintf("%s-%s",
		slugify.Slugify(config.Name), hashstring[0:8]))

	err = os.MkdirAll(dir, 0755)
	if err != nil {
		return "", err
	}
	return dir, nil
}

// Affer making changes to the worktree, push changes
func (g *GoGitRepo) Push(ctx context.Context, progress io.Writer) error {
	return g.repo.PushContext(ctx, &git.PushOptions{
		Progress: progress,
		Auth: &githttp.BasicAuth{ // reuse logic from clone?
			Username: "grafana",
			Password: g.config.Spec.GitHub.Token,
		},
	})
}

// Config implements repository.Repository.
func (g *GoGitRepo) Config() *provisioning.Repository {
	return g.config
}

// ReadTree implements repository.Repository.
func (g *GoGitRepo) ReadTree(ctx context.Context, ref string) ([]repository.FileTreeEntry, error) {
	entries := make([]repository.FileTreeEntry, 0, 100)
	err := util.Walk(g.tree.Filesystem, "/", func(path string, info fs.FileInfo, err error) error {
		if err != nil || strings.HasPrefix(path, "/.git") || path == "/" {
			return err
		}
		entry := repository.FileTreeEntry{
			Path: strings.TrimLeft(path, "/"),
			Size: info.Size(),
		}
		if !info.IsDir() {
			entry.Blob = true
			// For a real instance, this will likely be based on:
			// https://github.com/go-git/go-git/blob/main/_examples/ls/main.go#L25
			entry.Hash = fmt.Sprintf("TODO/%d", info.Size()) // but not used for
		}
		entries = append(entries, entry)
		return err
	})

	if err != nil {
		return nil, err
	}
	return entries, err
}

func (g *GoGitRepo) Test(ctx context.Context) (*provisioning.TestResults, error) {
	return &provisioning.TestResults{
		Success: g.tree != nil,
	}, nil
}

// Update implements repository.Repository.
func (g *GoGitRepo) Update(ctx context.Context, path string, ref string, data []byte, message string) error {
	return g.Write(ctx, path, ref, data, message)
}

// Create implements repository.Repository.
func (g *GoGitRepo) Create(ctx context.Context, path string, ref string, data []byte, message string) error {
	return g.Write(ctx, path, ref, data, message)
}

// Write implements repository.Repository.
func (g *GoGitRepo) Write(ctx context.Context, fpath string, ref string, data []byte, message string) error {
	if err := verifyPathWithoutRef(fpath, ref); err != nil {
		return err
	}

	dir := path.Dir(fpath)
	if dir != "" {
		err := g.tree.Filesystem.MkdirAll(dir, 0750)
		if err != nil {
			return err
		}
	}

	file, err := g.tree.Filesystem.Create(fpath)
	if err != nil {
		return err
	}
	_, err = file.Write(data)
	if err != nil {
		return err
	}

	_, err = g.tree.Add(fpath)
	if err != nil {
		return err
	}

	opts := &git.CommitOptions{}
	sig := repository.GetAuthorSignature(ctx)
	if sig != nil {
		opts.Author = &object.Signature{
			Name:  sig.Name,
			Email: sig.Email,
			When:  sig.When,
		}
	}
	_, err = g.tree.Commit(message, opts)
	return err
}

// Delete implements repository.Repository.
func (g *GoGitRepo) Delete(ctx context.Context, path string, ref string, message string) error {
	return g.tree.Filesystem.Remove(path) // missing slash
}

// Read implements repository.Repository.
func (g *GoGitRepo) Read(ctx context.Context, path string, ref string) (*repository.FileInfo, error) {
	return nil, &apierrors.StatusError{
		ErrStatus: metav1.Status{
			Message: "read is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

func verifyPathWithoutRef(path string, ref string) error {
	if path == "" {
		return fmt.Errorf("expected path")
	}
	if ref != "" {
		return fmt.Errorf("ref unsupported")
	}
	return nil
}

// History implements repository.Repository.
func (g *GoGitRepo) History(ctx context.Context, path string, ref string) ([]provisioning.HistoryItem, error) {
	return nil, &apierrors.StatusError{
		ErrStatus: metav1.Status{
			Message: "history is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}

// Validate implements repository.Repository.
func (g *GoGitRepo) Validate() field.ErrorList {
	return nil
}

// Webhook implements repository.Repository.
func (g *GoGitRepo) Webhook(ctx context.Context, req *http.Request) (*provisioning.WebhookResponse, error) {
	return nil, &apierrors.StatusError{
		ErrStatus: metav1.Status{
			Message: "history is not yet implemented",
			Code:    http.StatusNotImplemented,
		},
	}
}
