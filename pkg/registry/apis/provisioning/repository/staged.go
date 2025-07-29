package repository

import (
	context "context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/nanogit"
)

//go:generate mockery --name WrapWithStageFn --structname MockWrapWithStageFn --inpackage --filename mock_wrap_with_stage_fn.go --with-expecter
type WrapWithStageFn func(ctx context.Context, repo Repository, stageOptions StageOptions, fn func(repo Repository, staged bool) error) error

// StageMode defines the staging and commit behavior
type StageMode int

const (
	// StageModeCommitOnEach commits each file operation individually (default)
	StageModeCommitOnEach StageMode = iota
	// StageModeCommitOnlyOnce stages all changes and commits them all at once on push
	StageModeCommitOnlyOnce
	// StageModeCommitAndPushOnEach commits and pushes each file operation individually
	StageModeCommitAndPushOnEach
)

type StageOptions struct {
	// Ref custom ref
	Ref string
	// Push on every write
	PushOnWrites bool
	// Mode defines the staging and commit behavior
	Mode StageMode
	// Maximum time allowed for clone operation in seconds (0 means no limit)
	Timeout time.Duration
	// Commit message to use when Mode is StageModeCommitOnlyOnce
	CommitOnlyOnceMessage string
}

//go:generate mockery --name StageableRepository --structname MockStageableRepository --inpackage --filename stageable_repository_mock.go --with-expecter
type StageableRepository interface {
	Stage(ctx context.Context, opts StageOptions) (StagedRepository, error)
}

//go:generate mockery --name StagedRepository --structname MockStagedRepository --inpackage --filename staged_repository_mock.go --with-expecter
type StagedRepository interface {
	ReaderWriter
	Push(ctx context.Context) error
	Remove(ctx context.Context) error
}

// WrapWithStageAndPushIfPossible attempts to stage the given repository. If staging is supported,
// it runs the provided function on the staged repository, then pushes any changes and cleans up the staged repository.
// If staging is not supported, it runs the function on the original repository without pushing.
// The 'staged' argument to the function indicates whether a staged repository was used.
func WrapWithStageAndPushIfPossible(
	ctx context.Context,
	repo Repository,
	stageOptions StageOptions,
	fn func(repo Repository, staged bool) error,
) error {
	stageable, ok := repo.(StageableRepository)
	if !ok {
		return fn(repo, false)
	}

	staged, err := stageable.Stage(ctx, stageOptions)
	if err != nil {
		return fmt.Errorf("stage repository: %w", err)
	}

	// We don't, we simply log it
	// FIXME: should we handle this differently?
	defer func() {
		if err := staged.Remove(ctx); err != nil {
			logging.FromContext(ctx).Error("failed to remove staged repository after export", "err", err)
		}
	}()

	if err := fn(staged, true); err != nil {
		return err
	}

	if err = staged.Push(ctx); err != nil {
		if errors.Is(err, nanogit.ErrNothingToPush) {
			return nil // OK, already pushed
		}
		return fmt.Errorf("wrapped push error: %w", err)
	}
	return nil
}
