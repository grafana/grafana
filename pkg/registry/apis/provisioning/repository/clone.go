package repository

import (
	context "context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
)

// WrapWithCloneAndPushIfPossible clones a repository if possible, executes operations on the clone,
// and automatically pushes changes when the function completes. For repositories that support cloning,
// all operations are transparently executed on the clone, and the clone is automatically cleaned up
// afterward. If cloning is not supported, the original repository instance is used directly.
func WrapWithCloneAndPushIfPossible(
	ctx context.Context,
	repo Repository,
	cloneOptions CloneOptions,
	pushOptions PushOptions,
	beforeClone func(repo Repository) error,
	execute func(repo Repository, cloned bool) error,
	beforePush func(repo Repository) error,
) error {
	clonable, ok := repo.(ClonableRepository)
	if !ok {
		return execute(repo, false)
	}

	err := beforeClone(repo)
	if err != nil {
		return err
	}

	clone, err := clonable.Clone(ctx, cloneOptions)
	if err != nil {
		return fmt.Errorf("clone repository: %w", err)
	}

	// We don't, we simply log it
	// FIXME: should we handle this differently?
	defer func() {
		if err := clone.Remove(ctx); err != nil {
			logging.FromContext(ctx).Error("failed to remove cloned repository after export", "err", err)
		}
	}()

	err = execute(clone, true)
	if err != nil {
		return err
	}

	err = beforePush(clone)
	if err != nil {
		return err
	}

	return clone.Push(ctx, pushOptions)
}
