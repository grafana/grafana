package git

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
	"github.com/grafana/nanogit"
)

// stagedGitRepository implements repository.ClonedRepository by wrapping a gitRepository
// FIXME: this is a hack until we can delete the go-git cloned implementation
// once that happens we could do more magic here.
type stagedGitRepository struct {
	*gitRepository
	opts   repository.StageOptions
	writer nanogit.StagedWriter
}

func NewStagedGitRepository(ctx context.Context, repo *gitRepository, opts repository.StageOptions) (repository.StagedRepository, error) {
	if opts.Timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, opts.Timeout)
		defer cancel()
	}

	branch := opts.Ref
	if branch == "" {
		branch = repo.gitConfig.Branch
	}

	ref, err := repo.ensureBranchExists(ctx, branch)
	if err != nil {
		return nil, fmt.Errorf("ensure branch exists: %w", err)
	}

	writer, err := repo.client.NewStagedWriter(ctx, ref)
	if err != nil {
		return nil, fmt.Errorf("build staged writer: %w", err)
	}

	return &stagedGitRepository{
		gitRepository: repo,
		opts:          opts,
		writer:        writer,
	}, nil
}

// isRefSupported checks if the given ref is supported for staged operations.
// It returns true if ref is empty, equals the git config branch, or equals the staged options ref.
func (r *stagedGitRepository) isRefSupported(ref string) bool {
	if ref == "" {
		return true
	}
	if ref == r.gitConfig.Branch {
		return true
	}
	// Allow ref if it matches the staged options ref (the branch we're staging to)
	stagingBranch := r.opts.Ref
	if stagingBranch == "" {
		stagingBranch = r.gitConfig.Branch
	}
	return ref == stagingBranch
}

func (r *stagedGitRepository) Read(ctx context.Context, path, ref string) (*repository.FileInfo, error) {
	if !r.isRefSupported(ref) {
		return nil, errors.New("ref is not supported for staged repository")
	}

	// TODO: the read in the cloned is simplied used to check if a folder exists,
	// We should fix the usage and the interface so that it's not needed to load the entire blob
	return r.gitRepository.Read(ctx, path, ref)
}

func (r *stagedGitRepository) ReadTree(ctx context.Context, ref string) ([]repository.FileTreeEntry, error) {
	if !r.isRefSupported(ref) {
		return nil, errors.New("ref is not supported for staged repository")
	}

	ref = ""
	// TODO: I think we don't need this for cloned repository currently.
	// we should probably remove it from the interface or construct this tree from the writer itself

	return r.gitRepository.ReadTree(ctx, ref)
}

// handleCommitAndPush handles the commit and push logic based on the StageMode and PushOnWrites flag
func (r *stagedGitRepository) handleCommitAndPush(ctx context.Context, message string) error {
	switch r.opts.Mode {
	case repository.StageModeCommitOnEach:
		if err := r.commit(ctx, r.writer, message); err != nil {
			return err
		}
		// Only push if PushOnWrites is enabled
		if r.opts.PushOnWrites {
			return r.Push(ctx)
		}
		return nil
	case repository.StageModeCommitAndPushOnEach:
		if err := r.commit(ctx, r.writer, message); err != nil {
			return err
		}
		// Always push for this mode (explicit push-on-each mode)
		return r.Push(ctx)
	case repository.StageModeCommitOnlyOnce:
		// No immediate commit, will commit on Push
		return nil
	default:
		// Default to StageModeCommitOnEach for backward compatibility
		if err := r.commit(ctx, r.writer, message); err != nil {
			return err
		}
		// Only push if PushOnWrites is enabled
		if r.opts.PushOnWrites {
			return r.Push(ctx)
		}
		return nil
	}
}

func (r *stagedGitRepository) Create(ctx context.Context, path, ref string, data []byte, message string) error {
	if !r.isRefSupported(ref) {
		return errors.New("ref is not supported for staged repository")
	}

	if err := r.create(ctx, path, data, r.writer); err != nil {
		return err
	}

	return r.handleCommitAndPush(ctx, message)
}

func (r *stagedGitRepository) blobExists(ctx context.Context, path string) (bool, error) {
	if r.gitConfig.Path != "" {
		path = safepath.Join(r.gitConfig.Path, path)
	}
	return r.writer.BlobExists(ctx, path)
}

func (r *stagedGitRepository) Write(ctx context.Context, path, ref string, data []byte, message string) error {
	if !r.isRefSupported(ref) {
		return errors.New("ref is not supported for staged repository")
	}

	exists, err := r.blobExists(ctx, path)
	if err != nil {
		return fmt.Errorf("check if file exists: %w", err)
	}

	if exists {
		if err := r.update(ctx, path, data, r.writer); err != nil {
			return err
		}
	} else {
		if err := r.create(ctx, path, data, r.writer); err != nil {
			return err
		}
	}

	return r.handleCommitAndPush(ctx, message)
}

func (r *stagedGitRepository) Update(ctx context.Context, path, ref string, data []byte, message string) error {
	if !r.isRefSupported(ref) {
		return errors.New("ref is not supported for staged repository")
	}

	if safepath.IsDir(path) {
		return errors.New("cannot update a directory in a staged repository")
	}

	if err := r.update(ctx, path, data, r.writer); err != nil {
		return err
	}

	return r.handleCommitAndPush(ctx, message)
}

func (r *stagedGitRepository) Delete(ctx context.Context, path, ref, message string) error {
	if !r.isRefSupported(ref) {
		return errors.New("ref is not supported for staged repository")
	}

	if err := r.delete(ctx, path, r.writer); err != nil {
		return err
	}

	return r.handleCommitAndPush(ctx, message)
}

func (r *stagedGitRepository) Move(ctx context.Context, oldPath, newPath, ref, message string) error {
	if !r.isRefSupported(ref) {
		return errors.New("ref is not supported for staged repository")
	}

	if err := r.move(ctx, oldPath, newPath, r.writer); err != nil {
		return err
	}

	return r.handleCommitAndPush(ctx, message)
}

func (r *stagedGitRepository) Push(ctx context.Context) error {
	if r.opts.Timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, r.opts.Timeout)
		defer cancel()
	}

	if r.opts.Mode == repository.StageModeCommitOnlyOnce {
		message := r.opts.CommitOnlyOnceMessage
		if message == "" {
			message = "Staged changes"
		}

		if err := r.commit(ctx, r.writer, message); err != nil {
			return err
		}
	}

	err := r.writer.Push(ctx)
	if err != nil {
		// Convert nanogit-specific errors to repository-level errors to avoid leaky abstraction
		if errors.Is(err, nanogit.ErrNothingToPush) {
			return repository.ErrNothingToPush
		}
		if errors.Is(err, nanogit.ErrNothingToCommit) {
			return repository.ErrNothingToCommit
		}
		return err
	}
	return nil
}

func (r *stagedGitRepository) Remove(ctx context.Context) error {
	return r.writer.Cleanup(ctx)
}
