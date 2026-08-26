package export

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strconv"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// listHistory returns every stored version of a single resource, oldest first.
//
// Unified storage exposes history through the regular list endpoint: the
// grafana.app/get-history label selects the history source and a metadata.name
// field selector picks the resource. The server answers newest-first, so the
// result is re-sorted here — callers depend on chronological order and must not
// rely on the server's ordering.
//
// The current version is part of the history, so a caller replaying history
// must not also write the live object.
func listHistory(ctx context.Context, client dynamic.ResourceInterface, name string) ([]*unstructured.Unstructured, error) {
	list, err := client.List(ctx, metav1.ListOptions{
		LabelSelector: utils.LabelKeyGetHistory + "=true",
		FieldSelector: "metadata.name=" + name,
	})
	if err != nil {
		return nil, fmt.Errorf("list history for %s: %w", name, err)
	}

	versions := make([]*unstructured.Unstructured, 0, len(list.Items))
	for i := range list.Items {
		versions = append(versions, &list.Items[i])
	}

	sort.SliceStable(versions, func(i, j int) bool {
		return resourceVersionInt(versions[i]) < resourceVersionInt(versions[j])
	})

	return versions, nil
}

// resourceVersionInt parses a resource version for ordering. Unified storage
// issues monotonically increasing numeric versions; anything unparseable sorts
// first so it is written before the versions we can order, rather than being
// dropped.
func resourceVersionInt(item *unstructured.Unstructured) int64 {
	rv, err := strconv.ParseInt(item.GetResourceVersion(), 10, 64)
	if err != nil {
		return 0
	}
	return rv
}

// withVersionTimestamp carries a stored version's own update time into ctx as
// the git author time, so a replayed commit is dated when the change was made
// rather than when the export ran.
//
// Only the timestamp is overridden. The commit author identity stays whatever
// the job established: a Grafana identity is not a git identity, and inventing
// an email for one is a product decision, not something to guess here.
func withVersionTimestamp(ctx context.Context, item *unstructured.Unstructured) context.Context {
	meta, err := utils.MetaAccessor(item)
	if err != nil {
		return ctx
	}

	updated, err := meta.GetUpdatedTimestamp()
	if err != nil || updated == nil || updated.IsZero() {
		return ctx
	}

	sig := repository.CommitSignature{When: *updated}
	if existing := repository.GetAuthorSignature(ctx); existing != nil {
		sig.Name = existing.Name
		sig.Email = existing.Email
	}

	return repository.WithAuthorSignature(ctx, sig)
}

// exportItemHistory writes every stored version of one resource as its own
// commit, oldest first, in place of the single current-state write.
//
// Versions whose content matches the previous one produce no commit: the write
// layer reports that as ErrNothingToCommit, which is skipped rather than
// failed, so no-op saves collapse instead of creating empty commits.
func exportItemHistory(ctx context.Context,
	client dynamic.ResourceInterface,
	item *unstructured.Unstructured,
	options provisioning.ExportJobOptions,
	shim conversionShim,
	repositoryResources resources.RepositoryResources,
	progress jobs.JobProgressRecorder,
) error {
	name := item.GetName()
	gvk := item.GroupVersionKind()

	versions, err := listHistory(ctx, client, name)
	if err != nil {
		result := jobs.NewGVKResult(name, gvk).
			WithAction(repository.FileActionCreated).
			WithError(err)
		progress.Record(ctx, result.Build())
		return progress.TooManyErrors()
	}

	// No stored history is not an error: fall back to writing the live object so
	// the resource still lands in the repository.
	if len(versions) == 0 {
		versions = []*unstructured.Unstructured{item}
	}

	var wrote bool
	for _, version := range versions {
		if err := writeHistoricalVersion(ctx, version, options, shim, repositoryResources); err != nil {
			if errors.Is(err, repository.ErrNothingToCommit) || errors.Is(err, resources.ErrAlreadyInRepository) {
				continue
			}

			result := jobs.NewGVKResult(name, gvk).
				WithAction(repository.FileActionCreated).
				WithError(fmt.Errorf("writing version %s of %s: %w", version.GetResourceVersion(), name, err))
			progress.Record(ctx, result.Build())
			return progress.TooManyErrors()
		}
		wrote = true
	}

	action := repository.FileActionCreated
	if !wrote {
		action = repository.FileActionIgnored
	}
	progress.Record(ctx, jobs.NewGVKResult(name, gvk).WithAction(action).Build())

	return progress.TooManyErrors()
}

// writeHistoricalVersion writes one stored version, dated to when it was saved.
func writeHistoricalVersion(ctx context.Context,
	version *unstructured.Unstructured,
	options provisioning.ExportJobOptions,
	shim conversionShim,
	repositoryResources resources.RepositoryResources,
) error {
	if shim != nil {
		converted, err := shim(ctx, version)
		if err != nil {
			return err
		}
		version = converted
	}

	// Strip the manager annotations a version may carry from a period when the
	// resource was already provisioned: they describe the resource's state at
	// that moment, not the file being written, and the write layer refuses to
	// write anything it believes this repository already owns.
	version = version.DeepCopy()
	if meta, err := utils.MetaAccessor(version); err == nil {
		meta.SetManagerProperties(utils.ManagerProperties{})
	}

	_, _, err := repositoryResources.WriteResourceFileFromObject(withVersionTimestamp(ctx, version), version, resources.WriteOptions{
		Path: options.Path,
		Ref:  options.Branch,
	})

	return err
}

// historyStageMode reports how the repository should be staged for a job.
// Replaying history needs one commit per write; every other export batches all
// writes into a single commit.
func historyStageMode(history bool) repository.StageMode {
	if history {
		return repository.StageModeCommitOnEach
	}
	return repository.StageModeCommitOnlyOnce
}
