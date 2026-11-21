package main

import (
	"context"
	"io"

	"github.com/grafana/grafana-app-sdk/logging"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/sync"
	"github.com/grafana/grafana/pkg/setting"
)

// maxSyncWorkers matches the value the provisioning API server runs pull jobs with.
const maxSyncWorkers = 10

// runPull runs the same sync worker the job driver runs, so the repository status (including
// status.sync.lastRef for the next incremental pull) is updated exactly as a real pull job would.
func runPull(ctx context.Context, opts options, out io.Writer) error {
	run, err := newJobRun(ctx, opts)
	if err != nil {
		return err
	}

	t := run.target
	tracer := tracing.NewNoopTracerService()
	syncer := sync.NewSyncer(sync.Compare, sync.FullSync, sync.IncrementalSync, tracer, maxSyncWorkers, run.metrics, setting.ProvisioningSyncResourceTimeoutDefault)
	worker := sync.NewSyncWorker(t.grafana.clients, run.repositoryResources, t.patchStatus, syncer, run.metrics, tracer, maxSyncWorkers, setting.ProvisioningMaxFileSizeDefault)

	previousRef := t.cfg.Status.Sync.LastRef
	progress, status, processErr := run.process(ctx, worker, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{Incremental: opts.incremental},
	}, out, opts.jsonOutput)

	result := pullResult{Variance: progress.Variance(), PreviousRef: previousRef, Status: status}
	if result.LastRef, err = t.syncedRef(ctx); err != nil {
		logging.FromContext(ctx).Warn("unable to read the repository status after the pull", "error", err)
	}
	if err := printPullResult(out, result, opts.jsonOutput); err != nil {
		return err
	}
	return processErr
}

type pullResult struct {
	Variance    string                 `json:"variance,omitempty"`
	PreviousRef string                 `json:"previousRef,omitempty"`
	LastRef     string                 `json:"lastRef,omitempty"`
	Status      provisioning.JobStatus `json:"status"`
}

func printPullResult(out io.Writer, result pullResult, asJSON bool) error {
	if asJSON {
		return printJSON(out, result)
	}

	w := &errWriter{w: out}
	w.printf("%s pull finished: state=%s message=%q\n", result.Variance, result.Status.State, result.Status.Message)
	w.printf("  lastRef: %q -> %q\n", result.PreviousRef, result.LastRef)
	printStatusDetails(w, result.Status)
	return w.err
}
