package gogit

import (
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"path"
	"strings"

	"github.com/go-git/go-billy/v5/util"
	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/config"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
	githttp "github.com/go-git/go-git/v5/plumbing/transport/http"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
)

var _ repository.Repository = (*GoGitRepo)(nil)

type GoGitCloneOptions struct {
	Root string // tempdir (when empty, memory??)

	// If the branch does not exist, create it
	CreateIfNotExists bool

	// Skip intermediate commits and commit all before push
	SingleCommitBeforePush bool
}

type GoGitRepo struct {
	config            *provisioning.Repository
	opts              GoGitCloneOptions
	decryptedPassword string

	repo *git.Repository
	tree *git.Worktree
	dir  string // file path to worktree root (necessary? should use billy)
}

// This will create a new clone every time
// As structured, it is valid for one context and should not be shared across multiple requests
func Clone(
	ctx context.Context,
	config *provisioning.Repository,
	opts GoGitCloneOptions,
	secrets secrets.Service,
	progress io.Writer, // os.Stdout
) (*GoGitRepo, error) {
	gitcfg := config.Spec.GitHub
	if gitcfg == nil {
		return nil, fmt.Errorf("missing github config")
	}
	if gitcfg.Branch == "" {
		return nil, fmt.Errorf("missing base branch")
	}
	if opts.Root == "" {
		return nil, fmt.Errorf("missing root config")
	}

	decrypted, err := secrets.Decrypt(ctx, gitcfg.EncryptedToken)
	if err != nil {
		return nil, fmt.Errorf("error decrypting token: %w", err)
	}

	err = os.MkdirAll(opts.Root, 0700)
	if err != nil {
		return nil, err
	}
	dir, err := mkdirTempClone(opts.Root, config)
	if err != nil {
		return nil, err
	}
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
				return nil, err
			}
			err = worktree.Checkout(&git.CheckoutOptions{
				Branch: branch,
				Force:  true,
				Create: true,
			})
			if err != nil {
				return nil, fmt.Errorf("unable to create new branch %w", err)
			}
		}
	}
	if err != nil {
		return nil, fmt.Errorf("clone error %w", err)
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

	return &GoGitRepo{
		config:            config,
		opts:              opts,
		tree:              worktree,
		decryptedPassword: string(decrypted),
		repo:              repo,
		dir:               dir,
	}, nil
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

// Remove everything from the tree
func (g *GoGitRepo) Checkout(ctx context.Context, branch string, createIfNotFound bool) error {
	if branch == "" {
		return fmt.Errorf("expecting branch name")
	}

	branchCoOpts := git.CheckoutOptions{
		Branch: plumbing.NewBranchReferenceName(branch),
		Force:  true, // removes any local changes
	}
	err := g.tree.Checkout(&branchCoOpts)
	if err == nil {
		return nil // success
	}

	logger := logging.FromContext(ctx)
	logger.Info("local checkout failed, will attempt to fetch remote branch of same name.", "branch", branch)

	remote, err := g.repo.Remote("origin")
	if err != nil {
		return err
	}
	err = remote.Fetch(&git.FetchOptions{
		RefSpecs: []config.RefSpec{config.RefSpec(
			fmt.Sprintf("refs/heads/%s:refs/heads/%s", branch, branch),
		)},
		Auth: &githttp.BasicAuth{ // reuse logic from clone?
			Username: "grafana",
			Password: g.decryptedPassword,
		},
	})
	if err != nil {
		logger.Info("origin fetch failed.", "branch", branch, "err", err)
	}

	// Try again, this time create
	err = g.tree.Checkout(&branchCoOpts)
	if err != nil && createIfNotFound {
		// It did not exist, so lets create it
		branchCoOpts.Create = true
		return g.tree.Checkout(&branchCoOpts)
	}
	return err
}

// Affer making changes to the worktree, push changes
func (g *GoGitRepo) Push(ctx context.Context, progress io.Writer) error {
	if g.opts.SingleCommitBeforePush {
		_, err := g.tree.Commit("exported from grafana", &git.CommitOptions{
			All: true, // Add everything that changed
		})
		if err != nil {
			return err
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

	// For folders, just create the folder and ignore the commit
	if strings.HasSuffix(fpath, "/") {
		return g.tree.Filesystem.MkdirAll(fpath, 0750)
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

	// Skip commit for each file
	if g.opts.SingleCommitBeforePush {
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
	return err
}

// Delete implements repository.Repository.
func (g *GoGitRepo) Delete(ctx context.Context, path string, ref string, message string) error {
	return g.tree.Filesystem.Remove(path) // missing slash
}

// Read implements repository.Repository.
func (g *GoGitRepo) Read(ctx context.Context, path string, ref string) (*repository.FileInfo, error) {
	stat, err := g.tree.Filesystem.Lstat(path)
	if err != nil {
		return nil, err
	}
	info := &repository.FileInfo{
		Path: path,
		Modified: &metav1.Time{
			Time: stat.ModTime(),
		},
	}
	if !stat.IsDir() {
		f, err := g.tree.Filesystem.Open(path)
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
