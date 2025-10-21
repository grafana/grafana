package jobs

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/apps/provisioning/pkg/loki"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

const (
	// Loki label keys
	JobHistoryLabelKey   = "from"
	JobHistoryLabelValue = "job-history"
	NamespaceLabel       = "namespace"
	RepositoryLabel      = "repository"
	LokiJobSpanName      = "provisioning.job.historian.client"
)

const (
	// Default query settings
	defaultJobQueryRange = 24 * time.Hour // 1 days
	maxJobsLimit         = 10             // Maximum jobs to return per repository
)

//go:generate mockery --name LokiClient --structname MockLokiClient --inpackage --filename loki_client_mock.go --with-expecter
type LokiClient interface {
	Push(context.Context, []loki.Stream) error
	RangeQuery(ctx context.Context, logQL string, start, end, limit int64) (loki.QueryRes, error)
}

// LokiJobHistory implements the History interface using Loki for storage
type LokiJobHistory struct {
	client         LokiClient
	externalLabels map[string]string
}

// NewLokiJobHistory creates a new Loki-based job history implementation
func NewLokiJobHistory(cfg loki.Config) *LokiJobHistory {
	return &LokiJobHistory{
		client:         loki.NewClient(cfg),
		externalLabels: cfg.ExternalLabels,
	}
}

// WriteJob implements History.WriteJob by storing the job in Loki
func (h *LokiJobHistory) WriteJob(ctx context.Context, job *provisioning.Job) error {
	logger := logging.FromContext(ctx)

	// Clean up the job copy (remove claim label, similar to in-memory implementation)
	jobCopy := job.DeepCopy()
	delete(jobCopy.Labels, LabelJobClaim)

	// Create Loki stream
	stream := h.jobToStream(ctx, jobCopy)
	if len(stream.Values) == 0 {
		return nil
	}

	// Push to Loki synchronously
	writeCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	logger.Debug("Saving job history to Loki", "namespace", jobCopy.Namespace, "repository", jobCopy.Spec.Repository, "job", jobCopy.Name)

	if err := h.client.Push(writeCtx, []loki.Stream{stream}); err != nil {
		logger.Error("Failed to save job history to Loki", "error", err)
		return fmt.Errorf("failed to save job history: %w", err)
	}

	logger.Debug("Successfully saved job history to Loki")
	return nil
}

// RecentJobs implements History.RecentJobs by querying Loki for recent jobs
func (h *LokiJobHistory) RecentJobs(ctx context.Context, namespace, repo string) (*provisioning.JobList, error) {
	logger := logging.FromContext(ctx)

	// Build LogQL query
	logQL := h.buildJobQuery(namespace, repo)

	// Query time range (last 30 days by default)
	now := time.Now().UTC()
	from := now.Add(-defaultJobQueryRange)

	logger.Debug("Querying Loki for recent jobs", "namespace", namespace, "repository", repo, "query", logQL)

	// Execute query
	result, err := h.client.RangeQuery(ctx, logQL, from.UnixNano(), now.UnixNano(), int64(maxJobsLimit))
	if err != nil {
		return nil, fmt.Errorf("failed to query job history: %w", err)
	}

	// Convert result to JobList
	jobList, err := h.resultToJobList(result)
	if err != nil {
		return nil, fmt.Errorf("failed to parse job history results: %w", err)
	}

	logger.Debug("Retrieved jobs from Loki", "count", len(jobList.Items))
	return jobList, nil
}

// GetJob implements History.GetJob by finding a specific job
func (h *LokiJobHistory) GetJob(ctx context.Context, namespace, repo, uid string) (*provisioning.Job, error) {
	// Get recent jobs and find the specific one
	jobs, err := h.RecentJobs(ctx, namespace, repo)
	if err != nil {
		return nil, err
	}

	// Search for job by UID
	for _, job := range jobs.Items {
		if string(job.UID) == uid {
			return &job, nil
		}
	}

	return nil, apierrors.NewNotFound(provisioning.JobResourceInfo.GroupResource(), uid)
}

// jobToStream converts a Job to a Loki stream
func (h *LokiJobHistory) jobToStream(ctx context.Context, job *provisioning.Job) loki.Stream {
	logger := logging.FromContext(ctx)
	// Create stream labels
	labels := make(map[string]string)

	// Add external labels
	for k, v := range h.externalLabels {
		labels[k] = v
	}

	// Add system labels
	labels[JobHistoryLabelKey] = JobHistoryLabelValue
	labels[NamespaceLabel] = job.Namespace
	labels[RepositoryLabel] = job.Spec.Repository

	// Serialize job to JSON
	jobJSON, err := json.Marshal(job)
	if err != nil {
		logger.Error("Failed to marshal job to JSON", "error", err, "job", job.Name)
		return loki.Stream{Stream: labels, Values: []loki.Sample{}}
	}

	// Create timestamp (use finished time if available, otherwise creation time)
	timestamp := job.CreationTimestamp.Time
	if job.Status.Finished > 0 {
		// Status timestamps are in milliseconds
		timestamp = time.Unix(0, job.Status.Finished*int64(time.Millisecond))
	} else if job.Status.Started > 0 {
		// Status timestamps are in milliseconds
		timestamp = time.Unix(0, job.Status.Started*int64(time.Millisecond))
	}

	// Create sample
	sample := loki.Sample{
		T: timestamp,
		V: string(jobJSON),
	}

	return loki.Stream{
		Stream: labels,
		Values: []loki.Sample{sample},
	}
}

// buildJobQuery creates a LogQL query for jobs
func (h *LokiJobHistory) buildJobQuery(namespace, repo string) string {
	return fmt.Sprintf(`{%s=%q,%s=%q,%s=%q}`,
		JobHistoryLabelKey, JobHistoryLabelValue,
		NamespaceLabel, namespace,
		RepositoryLabel, repo,
	)
}

// resultToJobList converts Loki query results to a JobList
func (h *LokiJobHistory) resultToJobList(result loki.QueryRes) (*provisioning.JobList, error) {
	var jobs []provisioning.Job

	// Extract jobs from all streams
	for _, stream := range result.Data.Result {
		for _, sample := range stream.Values {
			var job provisioning.Job
			if err := json.Unmarshal([]byte(sample.V), &job); err != nil {
				// Unable to log here without context, just continue to next sample
				continue
			}
			jobs = append(jobs, job)
		}
	}

	// Sort jobs by timestamp (most recent first)
	sort.Slice(jobs, func(i, j int) bool {
		timeI := h.getJobTimestamp(&jobs[i])
		timeJ := h.getJobTimestamp(&jobs[j])
		return timeI.After(timeJ)
	})

	// Limit to maxJobs (similar to in-memory implementation: 10 jobs)
	if len(jobs) > 10 {
		jobs = jobs[:10]
	}

	return &provisioning.JobList{
		Items: jobs,
	}, nil
}

// getJobTimestamp returns the most relevant timestamp for sorting
func (h *LokiJobHistory) getJobTimestamp(job *provisioning.Job) time.Time {
	if job.Status.Finished > 0 {
		return time.Unix(job.Status.Finished, 0)
	}
	if job.Status.Started > 0 {
		return time.Unix(job.Status.Started, 0)
	}
	return job.CreationTimestamp.Time
}
