package nanogit

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
	"github.com/grafana/nanogit"
)

// stagedGitRepository implements repository.ClonedRepository by wrapping a gitRepository
// HACK: this is a hack until we can delete the go-git cloned implementation
// once that happens we could do more magic here.
type stagedGitRepository struct {
	*gitRepository
	opts   repository.CloneOptions
	writer nanogit.StagedWriter
}

func NewStagedGitRepository(ctx context.Context, repo *gitRepository, opts repository.CloneOptions) (repository.ClonedRepository, error) {
	if opts.BeforeFn != nil {
		if err := opts.BeforeFn(); err != nil {
			return nil, err
		}
	}

	if opts.Timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, opts.Timeout)
		defer cancel()
	}

	ref, err := repo.client.GetRef(ctx, "refs/heads/"+repo.branch)
	if err != nil {
		// TODO: opts.CreateIfNotExists doesn't make sense in the context of the staged repository
		// because we only support the branch that is passed in.
		// we should probably add branch to the repository.CloneOptions which should be repurposed
		// as some kind of branch creation options.
		return nil, err
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

func (r *stagedGitRepository) Read(ctx context.Context, path, ref string) (*repository.FileInfo, error) {
	if ref != "" {
		return nil, errors.New("ref is not supported for staged repository")
	}

	// TODO: read from writer if there
	return r.Read(ctx, path, ref)
}

func (r *stagedGitRepository) ReadTree(ctx context.Context, ref string) ([]repository.FileTreeEntry, error) {
	if ref != "" {
		return nil, errors.New("ref is not supported for staged repository")
	}

	// TODO: this one should be in the writer itself, it has the tree
	return r.ReadTree(ctx, ref)
}

func (r *stagedGitRepository) Create(ctx context.Context, path, ref string, data []byte, message string) error {
	if ref != "" {
		return errors.New("ref is not supported for staged repository")
	}

	if safepath.IsDir(path) {
		return errors.New("cannot create a directory in a staged repository")
	}

	if err := r.create(ctx, path, data, r.writer); err != nil {
		return err
	}

	if err := r.commit(ctx, r.writer, message); err != nil {
		return err
	}

	if r.opts.PushOnWrites {
		return r.Push(ctx, repository.PushOptions{})
	}

	return nil
}

func (r *stagedGitRepository) Write(ctx context.Context, path, ref string, data []byte, message string) error {
	if ref != "" {
		return errors.New("ref is not supported for staged repository")
	}

	// TODO: from writer check if path exists
	if true {
		if err := r.create(ctx, path, data, r.writer); err != nil {
			return err
		}
	} else {
		if err := r.update(ctx, path, data, r.writer); err != nil {
			return err
		}
	}

	if err := r.commit(ctx, r.writer, message); err != nil {
		return err
	}

	if r.opts.PushOnWrites {
		return r.Push(ctx, repository.PushOptions{})
	}

	return nil
}

func (r *stagedGitRepository) Update(ctx context.Context, path, ref string, data []byte, message string) error {
	if ref != "" {
		return errors.New("ref is not supported for staged repository")
	}

	if safepath.IsDir(path) {
		return errors.New("cannot update a directory in a staged repository")
	}

	if err := r.update(ctx, path, data, r.writer); err != nil {
		return err
	}

	if err := r.commit(ctx, r.writer, message); err != nil {
		return err
	}

	if r.opts.PushOnWrites {
		return r.Push(ctx, repository.PushOptions{})
	}

	return nil
}

func (r *stagedGitRepository) Delete(ctx context.Context, path, ref, message string) error {
	if ref != "" {
		return errors.New("ref is not supported for staged repository")
	}

	if err := r.delete(ctx, path, r.writer); err != nil {
		return err
	}

	if err := r.commit(ctx, r.writer, message); err != nil {
		return err
	}

	if r.opts.PushOnWrites {
		return r.Push(ctx, repository.PushOptions{})
	}

	return nil
}

func (r *stagedGitRepository) Push(ctx context.Context, opts repository.PushOptions) error {
	if opts.BeforeFn != nil {
		if err := opts.BeforeFn(); err != nil {
			return err
		}
	}

	if opts.Timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, opts.Timeout)
		defer cancel()
	}

	// TODO: improve push to not do anything if everything was pushed already
	return r.writer.Push(ctx)
}

func (r *stagedGitRepository) Remove(_ context.Context) error {
	// Since we're using nanogit which doesn't actually clone the repository,
	// we don't need to do anything here as there's nothing to clean up
	return nil
}
