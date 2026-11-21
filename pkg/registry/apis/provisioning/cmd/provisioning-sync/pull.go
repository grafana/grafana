package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	gosync "sync"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/sync"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/setting"
)

// maxSyncWorkers matches the value the provisioning API server runs pull jobs with.
const maxSyncWorkers = 10

// runPull runs the same sync worker the job driver runs, so the repository status (including
// status.sync.lastRef for the next incremental pull) is updated exactly as a real pull job would.
func runPull(ctx context.Context, opts options, out io.Writer) error {
	t, err := loadTarget(ctx, opts)
	if err != nil {
		return err
	}
	repo, err := buildRepository(ctx, t.cfg, opts.token, opts.homePath)
	if err != nil {
		return fmt.Errorf("build repository: %w", err)
	}

	clients := t.grafana.clients
	repositoryResources := resources.NewRepositoryResourcesFactory(resources.NewParserFactory(clients), clients, t.lister)
	metrics := jobs.RegisterJobMetrics(prometheus.NewRegistry())
	tracer := tracing.NewNoopTracerService()
	syncer := sync.NewSyncer(sync.Compare, sync.FullSync, sync.IncrementalSync, tracer, maxSyncWorkers, metrics, setting.ProvisioningSyncResourceTimeoutDefault)
	worker := sync.NewSyncWorker(clients, repositoryResources, t.patchStatus, syncer, metrics, tracer, maxSyncWorkers, setting.ProvisioningMaxFileSizeDefault)

	job := provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("provisioning-sync-cli-%d", time.Now().Unix()),
			Namespace: t.cfg.Namespace,
		},
		Spec: provisioning.JobSpec{
			Action:     provisioning.JobActionPull,
			Repository: t.cfg.Name,
			Pull:       &provisioning.SyncJobOptions{Incremental: opts.incremental},
		},
	}
	previousRef := t.cfg.Status.Sync.LastRef

	var (
		mu          gosync.Mutex
		lastMessage string
	)
	progress := jobs.NewJobProgressRecorder(func(_ context.Context, status provisioning.JobStatus) error {
		mu.Lock()
		defer mu.Unlock()
		if opts.jsonOutput || status.Message == lastMessage {
			return nil
		}
		lastMessage = status.Message
		_, err := fmt.Fprintf(out, "... %s\n", status.Message)
		return err
	}, &metrics, provisioning.JobActionPull)

	processErr := worker.Process(ctx, repo, job, progress)

	// Completing again after the worker returns is what the job driver does to read the final status.
	result := pullResult{Variance: progress.Variance(), PreviousRef: previousRef, Status: progress.Complete(ctx, processErr)}
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
		enc := json.NewEncoder(out)
		enc.SetIndent("", "  ")
		return enc.Encode(result)
	}

	status := result.Status
	w := &errWriter{w: out}
	w.printf("%s pull finished: state=%s message=%q\n", result.Variance, status.State, status.Message)
	w.printf("  lastRef: %q -> %q\n", result.PreviousRef, result.LastRef)
	for _, s := range status.Summary {
		w.printf("  %s/%s: create=%d update=%d delete=%d noop=%d warning=%d error=%d\n",
			s.Group, s.Kind, s.Create, s.Update, s.Delete, s.Noop, s.Warning, s.Error)
	}
	for _, msg := range status.Errors {
		w.printf("  error: %s\n", msg)
	}
	for _, msg := range status.Warnings {
		w.printf("  warning: %s\n", msg)
	}
	return w.err
}
