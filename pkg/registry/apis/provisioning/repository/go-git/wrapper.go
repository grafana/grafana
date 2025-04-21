package gogit

import (
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-git/go-billy/v5/util"
	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/go-git/go-git/v5/plumbing/transport/client"
	githttp "github.com/go-git/go-git/v5/plumbing/transport/http"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
)

const (
	// maxOperationBytes is the maximum size of a git operation in bytes (1 GB)
	maxOperationBytes   = int64(1 << 30)
	maxOperationTimeout = 10 * time.Minute
)

func init() {
	// Create a size-limited writer that will cancel the context if size is exceeded
	limitedTransport := NewByteLimitedTransport(http.DefaultTransport, maxOperationBytes)
	httpClient := githttp.NewClient(&http.Client{
		Transport: limitedTransport,
	})
	client.InstallProtocol("https", httpClient)
	client.InstallProtocol("http", httpClient)
}

var _ repository.Repository = (*GoGitRepo)(nil)

type GoGitRepo struct {
	config            *provisioning.Repository
	decryptedPassword string
	opts              repository.CloneOptions

	repo *git.Repository
	tree *git.Worktree
	dir  string // file path to worktree root (necessary? should use billy)
}

// This will create a new clone every time
// As structured, it is valid for one context and should not be shared across multiple requests
func Clone(
	ctx context.Context,
	root string,
	config *provisioning.Repository,
	opts repository.CloneOptions,
	secrets secrets.Service,
) (repository.ClonedRepository, error) {
	if root == "" {
		return nil, fmt.Errorf("missing root config")
	}

	if opts.BeforeFn != nil {
		if err := opts.BeforeFn(); err != nil {
			return nil, err
		}
	}

	// add a timeout to the operation
	timeout := maxOperationTimeout
	if opts.Timeout > 0 {
		timeout = opts.Timeout
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	decrypted, err := secrets.Decrypt(ctx, config.Spec.GitHub.EncryptedToken)
	if err != nil {
		return nil, fmt.Errorf("error decrypting token: %w", err)
	}

	if err := os.MkdirAll(root, 0700); err != nil {
		return nil, fmt.Errorf("create root dir: %w", err)
	}

	dir, err := mkdirTempClone(root, config)
	if err != nil {
		return nil, fmt.Errorf("create temp clone dir: %w", err)
	}

	progress := opts.Progress
	if progress == nil {
		progress = io.Discard
	}

	repo, worktree, err := clone(ctx, config, opts, decrypted, dir, progress)
	if err != nil {
		if err := os.RemoveAll(dir); err != nil {
			return nil, fmt.Errorf("remove temp clone dir after clone failed: %w", err)
		}

		return nil, fmt.Errorf("clone: %w", err)
	}

	return &GoGitRepo{
		config:            config,
		tree:              worktree,
		opts:              opts,
		decryptedPassword: string(decrypted),
		repo:              repo,
		dir:               dir,
	}, nil
}

func clone(ctx context.Context, config *provisioning.Repository, opts repository.CloneOptions, decrypted []byte, dir string, progress io.Writer) (*git.Repository, *git.Worktree, error) {
	gitcfg := config.Spec.GitHub
	url := fmt.Sprintf("%s.git", gitcfg.URL)

	branch := plumbing.NewBranchReferenceName(gitcfg.Branch)
	cloneOpts := &git.CloneOptions{
		ReferenceName: branch,
		Auth: &githttp.BasicAuth{
			Username: "grafana",         // this can be anything except an empty string for PAT
			Password: string(decrypted), // TODO... will need to get from a service!
		},
		URL:      url,
		Progress: progress,
	}

	repo, err := git.PlainCloneContext(ctx, dir, false, cloneOpts)
	if errors.Is(err, plumbing.ErrReferenceNotFound) && opts.CreateIfNotExists {
		cloneOpts.ReferenceName = "" // empty
		repo, err = git.PlainCloneContext(ctx, dir, false, cloneOpts)
		if err == nil {
			worktree, err := repo.Worktree()
			if err != nil {
				return nil, nil, err
			}
			err = worktree.Checkout(&git.CheckoutOptions{
				Branch: branch,
				Force:  true,
				Create: true,
			})
			if err != nil {
				return nil, nil, fmt.Errorf("unable to create new branch: %w", err)
			}
		}
	} else if err != nil {
		return nil, nil, fmt.Errorf("clone error: %w", err)
	}

	rcfg, err := repo.Config()
	if err != nil {
		return nil, nil, fmt.Errorf("error reading repository config %w", err)
	}

	origin := rcfg.Remotes["origin"]
	if origin == nil {
		return nil, nil, fmt.Errorf("missing origin remote %w", err)
	}

	if url != origin.URLs[0] {
		return nil, nil, fmt.Errorf("unexpected remote (expected: %s, found: %s)", url, origin.URLs[0])
	}

	worktree, err := repo.Worktree()
	if err != nil {
		return nil, nil, fmt.Errorf("get worktree: %w", err)
	}

	return repo, worktree, nil
}

func mkdirTempClone(root string, config *provisioning.Repository) (string, error) {
	if config.Namespace == "" {
		return "", fmt.Errorf("config is missing namespace")
	}
	if config.Name == "" {
		return "", fmt.Errorf("config is missing name")
	}
	return os.MkdirTemp(root, fmt.Sprintf("clone-%s-%s-", config.Namespace, config.Name))
}

// After making changes to the worktree, push changes
func (g *GoGitRepo) Push(ctx context.Context, opts repository.PushOptions) error {
	timeout := maxOperationTimeout
	if opts.Timeout > 0 {
		timeout = opts.Timeout
	}

	progress := opts.Progress
	if progress == nil {
		progress = io.Discard
	}

	if opts.BeforeFn != nil {
		if err := opts.BeforeFn(); err != nil {
			return err
		}
	}

	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	if !g.opts.PushOnWrites {
		_, err := g.tree.Commit("exported from grafana", &git.CommitOptions{
			All: true, // Add everything that changed
		})
		if err != nil {
			// empty commit is fine -- no change
			if !errors.Is(err, git.ErrEmptyCommit) {
				return err
			}
		}
	}

	err := g.repo.PushContext(ctx, &git.PushOptions{
		Progress: progress,
		Force:    true, // avoid fast-forward-errors
		Auth: &githttp.BasicAuth{ // reuse logic from clone?
			Username: "grafana",
			Password: g.decryptedPassword,
		},
	})
	if errors.Is(err, git.NoErrAlreadyUpToDate) {
		return nil // same as the target
	}
	return err
}

func (g *GoGitRepo) Remove(ctx context.Context) error {
	return os.RemoveAll(g.dir)
}

// Config implements repository.Repository.
func (g *GoGitRepo) Config() *provisioning.Repository {
	return g.config
}

// ReadTree implements repository.Repository.
func (g *GoGitRepo) ReadTree(ctx context.Context, ref string) ([]repository.FileTreeEntry, error) {
	var treePath string
	if g.config.Spec.GitHub.Path != "" {
		treePath = g.config.Spec.GitHub.Path
	}
	treePath = safepath.Clean(treePath)

	entries := make([]repository.FileTreeEntry, 0, 100)
	err := util.Walk(g.tree.Filesystem, treePath, func(path string, info fs.FileInfo, err error) error {
		// We already have an error, just pass it onwards.
		if err != nil ||
			// This is the root of the repository (or should pretend to be)
			safepath.Clean(path) == "" || path == treePath ||
			// This is the Git data
			(treePath == "" && strings.HasPrefix(path, ".git/")) {
			return err
		}
		if treePath != "" {
			path = strings.TrimPrefix(path, treePath)
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
	if errors.Is(err, fs.ErrNotExist) {
		// We intentionally ignore this case, as
	} else if err != nil {
		return nil, fmt.Errorf("failed to walk tree for ref '%s': %w", ref, err)
	}
	return entries, nil
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
	fpath = safepath.Join(g.config.Spec.GitHub.Path, fpath)
	if err := verifyPathWithoutRef(fpath, ref); err != nil {
		return err
	}

	// For folders, just create the folder and ignore the commit
	if safepath.IsDir(fpath) {
		return g.tree.Filesystem.MkdirAll(fpath, 0750)
	}

	dir := safepath.Dir(fpath)
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

	// Skip commit for each file
	if !g.opts.PushOnWrites {
		return nil
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
	if errors.Is(err, git.ErrEmptyCommit) {
		return nil // empty commit is fine -- no change
	}
	return err
}

// Delete implements repository.Repository.
func (g *GoGitRepo) Delete(ctx context.Context, path string, ref string, message string) error {
	if _, err := g.tree.Remove(safepath.Join(g.config.Spec.GitHub.Path, path)); err != nil {
		return err
	}

	return nil
}

// Read implements repository.Repository.
func (g *GoGitRepo) Read(ctx context.Context, path string, ref string) (*repository.FileInfo, error) {
	readPath := safepath.Join(g.config.Spec.GitHub.Path, path)
	stat, err := g.tree.Filesystem.Lstat(readPath)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, repository.ErrFileNotFound
	} else if err != nil {
		return nil, fmt.Errorf("failed to stat path '%s': %w", readPath, err)
	}
	info := &repository.FileInfo{
		Path: path,
		Modified: &metav1.Time{
			Time: stat.ModTime(),
		},
	}
	if !stat.IsDir() {
		f, err := g.tree.Filesystem.Open(readPath)
		if err != nil {
			return nil, err
		}
		info.Data, err = io.ReadAll(f)
		if err != nil {
			return nil, err
		}
	}
	return info, err
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
