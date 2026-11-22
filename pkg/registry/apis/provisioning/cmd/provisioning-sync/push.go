package main

import (
	"context"
	"io"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/sync"
	"github.com/grafana/grafana/pkg/setting"
)

// maxSyncWorkers matches the value the provisioning API server runs sync jobs with.
const maxSyncWorkers = 10

// runPush runs the same sync worker the job driver runs, so the state file gets the status
// (including status.sync.lastRef for the next incremental push) a real sync job would write.
func runPush(ctx context.Context, opts options, out io.Writer) error {
	if opts.dryRun {
		return runPlan(ctx, opts, out)
	}
	run, err := newJobRun(ctx, opts)
	if err != nil {
		return err
	}

	t := run.target
	tracer := tracing.NewNoopTracerService()
	syncer := sync.NewSyncer(sync.Compare, sync.FullSync, sync.IncrementalSync, tracer, maxSyncWorkers, run.metrics, setting.ProvisioningSyncResourceTimeoutDefault)
	worker := sync.NewSyncWorker(t.clients, run.repositoryResources, t.state.patch, syncer, run.metrics, tracer, maxSyncWorkers, setting.ProvisioningMaxFileSizeDefault)

	previousRef := t.cfg.Status.Sync.LastRef
	progress, status, processErr := run.process(ctx, worker, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{Incremental: opts.incremental},
	}, out, opts.jsonOutput)

	result := pushResult{Variance: progress.Variance(), PreviousRef: previousRef, LastRef: t.cfg.Status.Sync.LastRef, Status: status}
	if err := printPushResult(out, result, opts.jsonOutput); err != nil {
		return err
	}
	return processErr
}

type pushResult struct {
	Variance    string                 `json:"variance,omitempty"`
	PreviousRef string                 `json:"previousRef,omitempty"`
	LastRef     string                 `json:"lastRef,omitempty"`
	Status      provisioning.JobStatus `json:"status"`
}

func printPushResult(out io.Writer, result pushResult, asJSON bool) error {
	if asJSON {
		return printJSON(out, result)
	}

	w := &errWriter{w: out}
	w.printf("%s push finished: state=%s message=%q\n", result.Variance, result.Status.State, result.Status.Message)
	w.printf("  lastRef: %q -> %q\n", result.PreviousRef, result.LastRef)
	printStatusDetails(w, result.Status)
	return w.err
}
