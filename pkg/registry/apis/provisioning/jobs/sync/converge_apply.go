package sync

import (
	"context"
	"fmt"
	"sync"
	"time"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/converge"
	"github.com/grafana/grafana/pkg/converge/apply"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// applyChangesViaConverge executes the diff with the ordering derived from the
// dependency graph rather than from hand-maintained phase buckets.
//
// The actuator is unchanged: every operation still goes through applyChange,
// which owns quota reservation, the per-resource timeout, client resolution
// and progress recording. What this replaces is the scheduling around it —
// categorizeChanges, the six phases, the shallowest-first folder sort, the
// relocating-UID bookkeeping and the deferred orphan cleanup.
func applyChangesViaConverge(
	ctx context.Context,
	changes []ResourceFileChange,
	clients resources.ResourceClients,
	currentRef string,
	repositoryResources resources.RepositoryResources,
	progress jobs.JobProgressRecorder,
	tracer tracing.Tracer,
	maxSyncWorkers int,
	metrics jobs.JobMetrics,
	quotaTracker quotas.QuotaTracker,
	folderMetadataEnabled bool,
	resourceTimeout time.Duration,
) error {
	progress.SetTotal(ctx, len(changes))

	ctx, span := tracer.Start(ctx, "provisioning.sync.full.apply_changes",
		trace.WithAttributes(attribute.Int("changes_count", len(changes))),
	)
	defer span.End()

	// applyChange reports per-resource failures into progress and returns only
	// whether quota blocked the write. Treating every non-quota result as
	// success tells the helper that failed operations applied, so nothing
	// downstream of a failure is ever skipped — a folder removal would still
	// be attempted after the re-parent that was supposed to empty it failed.
	// Watching what gets recorded is how the actuator learns the difference.
	outcomes := &recordedOutcomes{JobProgressRecorder: progress, failed: map[string]bool{}}
	progress = outcomes

	ops, byRef, warnings, renames := translateChanges(changes)

	// A warning has nothing to execute, so it is recorded here rather than
	// occupying a stage. It still counts towards the circuit breaker: a
	// repository that is nothing but unsupported paths should stop rather than
	// report every one of them.
	for _, c := range warnings {
		applyChange(ctx, c, clients, currentRef, repositoryResources, progress, tracer, quotaTracker, folderMetadataEnabled, nil)
		if err := progress.TooManyErrors(); err != nil {
			return tracing.Error(span, err)
		}
	}

	// A folder rename is net zero — a new folder now, the old one removed in
	// the same plan — so the creations have to be allowed past the limit until
	// the removals free the slots.
	if renames > 0 {
		quotaTracker.AllowOverLimit(renames)
	}

	p, err := converge.Order(ops, converge.ModeFull, converge.ScopeConvergent)
	if err != nil {
		return tracing.Error(span, fmt.Errorf("order changes: %w", err))
	}
	span.SetAttributes(
		attribute.Int("stages", len(p.Stages)),
		attribute.Int("folder_renames", renames),
	)

	// The batch's stable-UID folder relocations, which each folder ensure
	// exempts from the duplicate-UID guard along its own ancestor chain.
	folderMoves := collectFolderMoves(changes)

	// Folders are serial: ensuring one walks its ancestors, so concurrent
	// ensures race on a shared parent.
	res, err := apply.Run(ctx, p, apply.ActuatorFunc(func(ctx context.Context, op converge.Op) error {
		change, ok := byRef[op.Ref()]
		if !ok {
			return fmt.Errorf("no change for %s", op.Ref())
		}
		// A deferred folder cleanup is removed by UID, not through the
		// resource-delete path: the old folder's list item carries a name but
		// no group or resource, because nothing in the repository declares it
		// any more. The planner says when to remove it; which call does the
		// removing is entirely the consumer's business, and provisioning has
		// two ways of removing a folder.
		if op.Kind == converge.OpRemoveContainer && change.IsOrphanFolderCleanup() {
			return removeOrphanFolder(ctx, op, change, repositoryResources, progress, tracer)
		}

		moves := folderMoves
		if op.Kind != converge.OpEnsureContainer && (op.Kind != converge.OpMove || !op.Key.IsContainer()) {
			moves = nil
		}
		if blocked := applyChange(ctx, change, clients, currentRef, repositoryResources, progress, tracer, quotaTracker, folderMetadataEnabled, moves); blocked {
			// Quota blocked it before any write was attempted. Capacity freed
			// by the writes that do succeed is not knowable from here, so the
			// retry is the helper's to schedule.
			return apply.ErrDeferred
		}
		if err := outcomes.errorAt(change.Path); err != nil {
			// Already reported to the user; returned here only so the helper
			// skips what depended on it.
			return err
		}
		return nil
	}), apply.Config{
		Workers: maxSyncWorkers,
		// Container moves are folder ensures underneath, which walk ancestors,
		// so they serialise with the rest of the container work.
		Serial:    []converge.OpKind{converge.OpEnsureContainer, converge.OpRemoveContainer, converge.OpMove},
		OpTimeout: resourceTimeout,
		// Drain the stage, then stop: a dependent of a failed operation is
		// already skipped, and stopping on the first failure would leave the
		// rest of the stage unreported.
		ContinueOnError: false,
		RetryDeferred:   true,
		Halt:            progress.TooManyErrors,
	})
	if err != nil {
		return tracing.Error(span, err)
	}

	// An operation the helper skipped was never handed to applyChange, so
	// nothing has reported it. A folder left in place because the re-parent
	// that should have emptied it failed is exactly the thing a user needs
	// told; the dependency graph knowing not to attempt it is not the same as
	// saying so.
	for _, o := range res.Outcomes {
		if o.Status != apply.Skipped {
			continue
		}
		change, ok := byRef[o.Ref]
		if !ok {
			continue
		}
		result := jobs.NewFolderResult(change.Path)
		if !safepath.IsDir(change.Path) {
			result = jobs.NewPathOnlyResult(change.Path)
		}
		// Ignored, not the action it would have had: nothing was attempted.
		progress.Record(ctx, result.
			WithAction(repository.FileActionIgnored).
			WithError(fmt.Errorf("not attempted because dependent path changes failed")).
			AsSkipped().
			Build())
	}

	// applyChange records every per-resource outcome itself, so a failure is
	// already reported and does not fail the job. What is left is the quota
	// refusal, which only becomes final once the retry has had its turn.
	for _, o := range res.Outcomes {
		if o.Status != apply.Deferred {
			continue
		}
		progress.Record(ctx, jobs.NewPathOnlyResult(string(o.Op.Key)).
			WithError(quotas.NewQuotaExceededError(fmt.Errorf("resource quota exceeded, skipping creation of %s", o.Op.Key))).
			AsSkipped().
			Build())
	}
	return progress.TooManyErrors()
}

// recordedOutcomes watches what the actuator reports so the helper can tell a
// failed operation from a successful one.
type recordedOutcomes struct {
	jobs.JobProgressRecorder

	mu     sync.Mutex
	failed map[string]bool
	errs   map[string]error
}

func (r *recordedOutcomes) Record(ctx context.Context, result jobs.JobResourceResult) {
	if err := result.Error(); err != nil {
		r.mu.Lock()
		if r.errs == nil {
			r.errs = map[string]error{}
		}
		key := safepath.EnsureTrailingSlash(result.Path())
		if !safepath.IsDir(result.Path()) {
			key = result.Path()
		}
		r.failed[key] = true
		r.errs[key] = err
		r.mu.Unlock()
	}
	r.JobProgressRecorder.Record(ctx, result)
}

func (r *recordedOutcomes) errorAt(path string) error {
	key := path
	if safepath.IsDir(path) {
		key = safepath.EnsureTrailingSlash(path)
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.errs[key]
}

// removeOrphanFolder deletes a folder that had to survive until its children
// were re-parented or removed.
func removeOrphanFolder(
	ctx context.Context,
	op converge.Op,
	change ResourceFileChange,
	repositoryResources resources.RepositoryResources,
	progress jobs.JobProgressRecorder,
	tracer tracing.Tracer,
) error {
	uid := string(op.Identity)
	path := string(op.Key)

	// A folder whose dependent path changes failed is left alone: removing it
	// would strand whatever did not manage to move out.
	if progress.HasDirPathFailedCreation(path) ||
		progress.HasDirPathFailedDeletion(path) ||
		progress.HasChildPathFailedCreation(path) ||
		progress.HasChildPathFailedUpdate(path) {
		skipCtx, skipSpan := tracer.Start(ctx, "provisioning.sync.full.apply_changes.skip_orphan_folder_deletion")
		progress.Record(skipCtx, jobs.NewFolderResult(path).
			WithName(uid).
			WithReason(change.Reason).
			WithError(fmt.Errorf("folder was not deleted because dependent path changes failed")).
			AsSkipped().
			Build())
		skipSpan.End()
		return nil
	}

	// The context distinguishes the two reasons a folder outlived its
	// contents, because that is what a user reading the job output needs to
	// tell them apart.
	context := "orphan folder " + uid
	if change.FolderRenamed {
		context = "old folder " + uid + " after UID change"
	}

	result := jobs.NewFolderResult(path).
		WithAction(repository.FileActionDeleted).
		WithName(uid).
		WithReason(change.Reason)
	if err := repositoryResources.RemoveFolder(ctx, uid); err != nil {
		result.WithError(fmt.Errorf("delete %s: %w", context, err))
	}
	progress.Record(ctx, result.Build())
	return progress.TooManyErrors()
}

// translateChanges converts the diff into operations the ordering understands,
// keeping a way back to the original change for the actuator.
func translateChanges(changes []ResourceFileChange) (
	ops []converge.Op,
	byRef map[converge.OpRef]ResourceFileChange,
	warnings []ResourceFileChange,
	folderRenames int,
) {
	ops = make([]converge.Op, 0, len(changes))
	byRef = make(map[converge.OpRef]ResourceFileChange, len(changes))

	for _, c := range changes {
		if c.Action == repository.FileActionIgnored {
			warnings = append(warnings, c)
			continue
		}

		key := converge.Key(c.Path)
		isDir := safepath.IsDir(c.Path)
		if isDir {
			key = key.AsContainer()
		}
		op := converge.Op{
			Key:         key,
			Fingerprint: converge.Fingerprint(c.Hash),
			Container:   key.Parent(),
		}
		if c.Existing != nil {
			op.Identity = converge.Identity(c.Existing.Name)
		}

		switch {
		case c.Action == repository.FileActionRenamed:
			op.Kind = converge.OpMove
			if c.Existing != nil {
				op.From = converge.Key(c.Existing.Path)
			}
		case isDir && c.Action == repository.FileActionDeleted:
			op.Kind = converge.OpRemoveContainer
			if c.OrphanCleanup || c.Reason != "" {
				op.Reason = converge.Reason(c.Reason)
			}
		case isDir && c.Existing != nil && !c.FolderRenamed &&
			safepath.EnsureTrailingSlash(c.Existing.Path) != string(key):
			// A stable-UID relocation: the folder keeps its identity and
			// changes path. The diff states it as an update whose Existing
			// sits at the old path, and translating that as a bare ensure
			// drops the edge that vacates the old parent — so the parent's
			// removal can be scheduled before the relocation and fails on a
			// folder that is not empty. Stated as a move, the origin is in the
			// graph.
			op.Kind = converge.OpMove
			op.From = converge.Key(safepath.EnsureTrailingSlash(c.Existing.Path))

		case isDir:
			op.Kind = converge.OpEnsureContainer
			if c.FolderRenamed {
				folderRenames++
				// The new folder and the old one's removal are one unit: a
				// half-applied rename leaves children parented to a folder
				// that is about to go.
				op.Group = converge.GroupID("rename:" + string(key))
			}
		case c.Action == repository.FileActionDeleted:
			op.Kind = converge.OpDelete
		case c.Action == repository.FileActionUpdated:
			op.Kind = converge.OpUpdate
		default:
			op.Kind = converge.OpCreate
		}

		ops = append(ops, op)
		byRef[op.Ref()] = c
	}

	// A folder being renamed keeps its path, so the removal of the old UID is
	// emitted as a second operation at the same key and joins the group.
	ops = append(ops, oldFolderRemovals(changes)...)
	for _, op := range oldFolderRemovals(changes) {
		byRef[op.Ref()] = ResourceFileChange{
			Action:        repository.FileActionDeleted,
			Path:          string(op.Key),
			Existing:      existingFor(changes, string(op.Key)),
			OrphanCleanup: true,
			FolderRenamed: true,
			Reason:        provisioning.ReasonFolderMetadataUpdated,
		}
	}
	return ops, byRef, warnings, folderRenames
}

func oldFolderRemovals(changes []ResourceFileChange) []converge.Op {
	// A diff may already carry the removal — the planner emits it as part of
	// the re-identification — in which case synthesising a second one deletes
	// the folder twice and the second attempt reports a resource that is not
	// found. Only derive it when the diff left it implicit.
	// Keyed by path *and* identity: a folder being renamed and a duplicate
	// orphan can both sit at one path under different UIDs, and both have to
	// go.
	removed := make(map[string]bool, len(changes))
	for _, c := range changes {
		if c.Action == repository.FileActionDeleted && safepath.IsDir(c.Path) && c.Existing != nil {
			removed[safepath.EnsureTrailingSlash(c.Path)+"|"+c.Existing.Name] = true
		}
	}

	var out []converge.Op
	for _, c := range changes {
		if !c.FolderRenamed || c.Existing == nil {
			continue
		}
		if removed[safepath.EnsureTrailingSlash(c.Path)+"|"+c.Existing.Name] {
			continue
		}
		key := converge.Key(c.Path).AsContainer()
		out = append(out, converge.Op{
			Kind:      converge.OpRemoveContainer,
			Key:       key,
			Identity:  converge.Identity(c.Existing.Name),
			Reason:    converge.ReasonReparent,
			Group:     converge.GroupID("rename:" + string(key)),
			Container: key.Parent(),
		})
	}
	return out
}

func existingFor(changes []ResourceFileChange, path string) *provisioning.ResourceListItem {
	for _, c := range changes {
		if safepath.EnsureTrailingSlash(c.Path) == path && c.Existing != nil {
			return c.Existing
		}
	}
	return nil
}
