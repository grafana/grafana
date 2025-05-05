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
	fn func(repo Repository, cloned bool) error,
) error {
	clonable, ok := repo.(ClonableRepository)
	if !ok {
		return fn(repo, false)
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

	if err := fn(clone, true); err != nil {
		return err
	}

	return clone.Push(ctx, pushOptions)
}
