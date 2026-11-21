package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	gosync "sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// jobRun holds what pull and push share: the target, the repository built from it, and the
// pieces the job workers are constructed from.
type jobRun struct {
	target              *target
	repo                repository.Repository
	repositoryResources resources.RepositoryResourcesFactory
	metrics             jobs.JobMetrics
}

func newJobRun(ctx context.Context, opts options) (*jobRun, error) {
	t, err := loadTarget(opts)
	if err != nil {
		return nil, err
	}
	repo, err := buildRepository(ctx, t.cfg, opts.token)
	if err != nil {
		return nil, fmt.Errorf("build repository: %w", err)
	}
	return &jobRun{
		target:              t,
		repo:                repo,
		repositoryResources: resources.NewRepositoryResourcesFactory(resources.NewParserFactory(t.clients), t.clients, t.lister),
		metrics:             jobs.RegisterJobMetrics(prometheus.NewRegistry()),
	}, nil
}

// worker is the part of a job worker the CLI drives, as the job driver does.
type worker interface {
	Process(ctx context.Context, repo repository.Repository, job provisioning.Job, progress jobs.JobProgressRecorder) error
}

// process runs one job through w and returns its recorder and final status. Progress messages
// are printed as they change unless quiet is set.
func (r *jobRun) process(ctx context.Context, w worker, spec provisioning.JobSpec, out io.Writer, quiet bool) (jobs.JobProgressRecorder, provisioning.JobStatus, error) {
	spec.Repository = r.target.cfg.Name
	job := provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("provisioning-sync-cli-%d", time.Now().Unix()),
			Namespace: r.target.cfg.Namespace,
		},
		Spec: spec,
	}

	var (
		mu          gosync.Mutex
		lastMessage string
	)
	progress := jobs.NewJobProgressRecorder(func(_ context.Context, status provisioning.JobStatus) error {
		mu.Lock()
		defer mu.Unlock()
		if quiet || status.Message == lastMessage {
			return nil
		}
		lastMessage = status.Message
		_, err := fmt.Fprintf(out, "... %s\n", status.Message)
		return err
	}, &r.metrics, spec.Action)

	processErr := w.Process(ctx, r.repo, job, progress)
	// Completing again after the worker returns is what the job driver does to read the final status.
	return progress, progress.Complete(ctx, processErr), processErr
}

func printJSON(out io.Writer, v any) error {
	enc := json.NewEncoder(out)
	enc.SetIndent("", "  ")
	return enc.Encode(v)
}

func printStatusDetails(w *errWriter, status provisioning.JobStatus) {
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
}
