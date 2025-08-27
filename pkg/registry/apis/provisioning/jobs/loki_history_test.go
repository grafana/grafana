package jobs

import (
	"context"
	"encoding/json"
	"errors"
	"net/url"
	"testing"
	"time"

	"github.com/grafana/grafana/apps/provisioning/pkg/loki"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestLokiJobHistory_WriteJob(t *testing.T) {
	// Create comprehensive test job with all spec and status fields
	job := &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:              "test-job",
			Namespace:         "test-namespace",
			UID:               types.UID("test-uid"),
			CreationTimestamp: metav1.NewTime(time.Now()),
			Labels: map[string]string{
				"test":        "label",
				LabelJobClaim: "should-be-removed",
				"env":         "production",
			},
			Annotations: map[string]string{
				"description": "Test job for validation",
			},
		},
		Spec: provisioning.JobSpec{
			Action:     provisioning.JobActionPull,
			Repository: "test-repo",
			Pull: &provisioning.SyncJobOptions{
				Incremental: true,
			},
			Push: &provisioning.ExportJobOptions{
				Message: "Export test",
				Folder:  "dashboards",
				Branch:  "main",
				Path:    "/exported",
			},
			Migrate: &provisioning.MigrateJobOptions{
				History: true,
				Message: "Migration test",
			},
			Delete: &provisioning.DeleteJobOptions{
				Ref:   "main",
				Paths: []string{"/old/dashboard.json", "/old/folder/"},
				Resources: []provisioning.ResourceRef{{
					Name:  "dashboard-uid",
					Kind:  "Dashboard",
					Group: "dashboard.grafana.app",
				}},
			},
			Move: &provisioning.MoveJobOptions{
				Ref:        "feature-branch",
				Paths:      []string{"/src/dashboard.json"},
				TargetPath: "/dest/",
				Resources: []provisioning.ResourceRef{{
					Name:  "moved-dashboard",
					Kind:  "Dashboard",
					Group: "dashboard.grafana.app",
				}},
			},
			PullRequest: &provisioning.PullRequestJobOptions{
				Ref:  "feature-123",
				PR:   123,
				Hash: "abc123def456",
				URL:  "https://github.com/org/repo/pull/123",
			},
		},
		Status: provisioning.JobStatus{
			State:    provisioning.JobStateSuccess,
			Started:  time.Now().UnixMilli() - 100000, // 100 seconds ago in milliseconds
			Finished: time.Now().UnixMilli(),          // Now in milliseconds
			Message:  "Job completed successfully",
			Errors:   []string{"warning: deprecated field used"},
			Progress: 100.0,
			Summary: []*provisioning.JobResourceSummary{{
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
				Total:    10,
				Create:   3,
				Update:   5,
				Delete:   1,
				Write:    8,
				Error:    1,
				Noop:     0,
				Errors:   []string{"failed to process dashboard-x"},
			}},
		},
	}

	t.Run("jobToStream creates correct stream with all fields", func(t *testing.T) {
		history := createTestLokiJobHistory(t)
		// Clean job copy like WriteJob does
		jobCopy := job.DeepCopy()
		delete(jobCopy.Labels, LabelJobClaim)

		stream := history.jobToStream(context.Background(), jobCopy)

		// Verify labels
		assert.Equal(t, JobHistoryLabelValue, stream.Stream[JobHistoryLabelKey])
		assert.Equal(t, job.Namespace, stream.Stream[NamespaceLabel])
		assert.Equal(t, job.Spec.Repository, stream.Stream[RepositoryLabel])
		assert.Equal(t, "test-value", stream.Stream["test-key"]) // external label

		// Verify we have a sample
		require.Len(t, stream.Values, 1)

		// Verify timestamp (should use finished time converted from milliseconds)
		expectedTime := time.Unix(0, job.Status.Finished*int64(time.Millisecond))
		assert.Equal(t, expectedTime, stream.Values[0].T)

		// Verify job data is JSON and contains all fields
		var deserializedJob provisioning.Job
		err := json.Unmarshal([]byte(stream.Values[0].V), &deserializedJob)
		require.NoError(t, err)

		// Verify metadata fields
		assert.Equal(t, "test-job", deserializedJob.Name)
		assert.Equal(t, "test-namespace", deserializedJob.Namespace)
		assert.Equal(t, types.UID("test-uid"), deserializedJob.UID)
		assert.Equal(t, "production", deserializedJob.Labels["env"])
		assert.Equal(t, "Test job for validation", deserializedJob.Annotations["description"])
		// Verify claim label was removed
		_, exists := deserializedJob.Labels[LabelJobClaim]
		assert.False(t, exists)

		// Verify spec fields
		assert.Equal(t, provisioning.JobActionPull, deserializedJob.Spec.Action)
		assert.Equal(t, "test-repo", deserializedJob.Spec.Repository)
		require.NotNil(t, deserializedJob.Spec.Pull)
		assert.True(t, deserializedJob.Spec.Pull.Incremental)
		require.NotNil(t, deserializedJob.Spec.Push)
		assert.Equal(t, "Export test", deserializedJob.Spec.Push.Message)
		assert.Equal(t, "dashboards", deserializedJob.Spec.Push.Folder)
		assert.Equal(t, "main", deserializedJob.Spec.Push.Branch)
		assert.Equal(t, "/exported", deserializedJob.Spec.Push.Path)
		require.NotNil(t, deserializedJob.Spec.Migrate)
		assert.True(t, deserializedJob.Spec.Migrate.History)
		assert.Equal(t, "Migration test", deserializedJob.Spec.Migrate.Message)
		require.NotNil(t, deserializedJob.Spec.Delete)
		assert.Equal(t, "main", deserializedJob.Spec.Delete.Ref)
		assert.Equal(t, []string{"/old/dashboard.json", "/old/folder/"}, deserializedJob.Spec.Delete.Paths)
		require.Len(t, deserializedJob.Spec.Delete.Resources, 1)
		assert.Equal(t, "dashboard-uid", deserializedJob.Spec.Delete.Resources[0].Name)
		assert.Equal(t, "Dashboard", deserializedJob.Spec.Delete.Resources[0].Kind)
		assert.Equal(t, "dashboard.grafana.app", deserializedJob.Spec.Delete.Resources[0].Group)
		require.NotNil(t, deserializedJob.Spec.Move)
		assert.Equal(t, "feature-branch", deserializedJob.Spec.Move.Ref)
		assert.Equal(t, []string{"/src/dashboard.json"}, deserializedJob.Spec.Move.Paths)
		assert.Equal(t, "/dest/", deserializedJob.Spec.Move.TargetPath)
		require.Len(t, deserializedJob.Spec.Move.Resources, 1)
		assert.Equal(t, "moved-dashboard", deserializedJob.Spec.Move.Resources[0].Name)
		require.NotNil(t, deserializedJob.Spec.PullRequest)
		assert.Equal(t, "feature-123", deserializedJob.Spec.PullRequest.Ref)
		assert.Equal(t, 123, deserializedJob.Spec.PullRequest.PR)
		assert.Equal(t, "abc123def456", deserializedJob.Spec.PullRequest.Hash)
		assert.Equal(t, "https://github.com/org/repo/pull/123", deserializedJob.Spec.PullRequest.URL)

		// Verify status fields
		assert.Equal(t, provisioning.JobStateSuccess, deserializedJob.Status.State)
		assert.Equal(t, job.Status.Started, deserializedJob.Status.Started)
		assert.Equal(t, job.Status.Finished, deserializedJob.Status.Finished)
		assert.Equal(t, "Job completed successfully", deserializedJob.Status.Message)
		assert.Equal(t, []string{"warning: deprecated field used"}, deserializedJob.Status.Errors)
		assert.Equal(t, 100.0, deserializedJob.Status.Progress)
		require.Len(t, deserializedJob.Status.Summary, 1)
		summary := deserializedJob.Status.Summary[0]
		assert.Equal(t, "dashboard.grafana.app", summary.Group)
		assert.Equal(t, "dashboards", summary.Resource)
		assert.Equal(t, int64(10), summary.Total)
		assert.Equal(t, int64(3), summary.Create)
		assert.Equal(t, int64(5), summary.Update)
		assert.Equal(t, int64(1), summary.Delete)
		assert.Equal(t, int64(8), summary.Write)
		assert.Equal(t, int64(1), summary.Error)
		assert.Equal(t, int64(0), summary.Noop)
		assert.Equal(t, []string{"failed to process dashboard-x"}, summary.Errors)
	})

	t.Run("buildJobQuery creates correct LogQL", func(t *testing.T) {
		history := createTestLokiJobHistory(t)

		query := history.buildJobQuery("test-ns", "test-repo")

		expected := `{from="job-history",namespace="test-ns",repository="test-repo"}`
		assert.Equal(t, expected, query)
	})

	t.Run("getJobTimestamp returns correct timestamp", func(t *testing.T) {
		history := createTestLokiJobHistory(t)

		// Test finished time priority
		jobWithFinished := &provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{
				CreationTimestamp: metav1.NewTime(time.Unix(100, 0)),
			},
			Status: provisioning.JobStatus{
				Started:  200,
				Finished: 300,
			},
		}
		ts := history.getJobTimestamp(jobWithFinished)
		assert.Equal(t, time.Unix(300, 0), ts)

		// Test started time when no finished time
		jobWithStarted := &provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{
				CreationTimestamp: metav1.NewTime(time.Unix(100, 0)),
			},
			Status: provisioning.JobStatus{
				Started: 200,
			},
		}
		ts = history.getJobTimestamp(jobWithStarted)
		assert.Equal(t, time.Unix(200, 0), ts)

		// Test creation time when no other timestamps
		jobWithCreation := &provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{
				CreationTimestamp: metav1.NewTime(time.Unix(100, 0)),
			},
		}
		ts = history.getJobTimestamp(jobWithCreation)
		assert.Equal(t, time.Unix(100, 0), ts)
	})
}

func TestLokiJobHistory_Integration(t *testing.T) {
	// Create comprehensive test job with all spec and status fields for integration tests
	integrationJob := &provisioning.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:              "integration-job",
			Namespace:         "test-namespace",
			UID:               types.UID("integration-uid"),
			CreationTimestamp: metav1.NewTime(time.Now()),
			Labels: map[string]string{
				"test":        "integration",
				LabelJobClaim: "should-be-removed",
			},
		},
		Spec: provisioning.JobSpec{
			Action:     provisioning.JobActionPull,
			Repository: "test-repo",
		},
		Status: provisioning.JobStatus{
			State:    provisioning.JobStateSuccess,
			Started:  time.Now().UnixMilli() - 100000,
			Finished: time.Now().UnixMilli(),
			Message:  "Integration test completed",
		},
	}

	t.Run("WriteJob with mock validates complete flow", func(t *testing.T) {
		mockClient := NewMockLokiClient(t)
		history := &LokiJobHistory{
			client: mockClient,
			externalLabels: map[string]string{
				"service": "grafana-provisioning",
			},
		}

		// Set up mock expectation
		mockClient.EXPECT().Push(
			mock.MatchedBy(func(ctx context.Context) bool { return true }),
			mock.MatchedBy(func(streams []loki.Stream) bool {
				// Validate the stream structure
				if len(streams) != 1 {
					return false
				}
				stream := streams[0]
				// Check labels
				if stream.Stream[JobHistoryLabelKey] != JobHistoryLabelValue {
					return false
				}
				if stream.Stream[NamespaceLabel] != "test-namespace" {
					return false
				}
				if stream.Stream[RepositoryLabel] != "test-repo" {
					return false
				}
				if stream.Stream["service"] != "grafana-provisioning" {
					return false
				}
				// Check we have values
				if len(stream.Values) != 1 {
					return false
				}
				// Validate JSON content
				var deserializedJob provisioning.Job
				if err := json.Unmarshal([]byte(stream.Values[0].V), &deserializedJob); err != nil {
					return false
				}
				// Check key fields are preserved
				return deserializedJob.Name == "integration-job" &&
					deserializedJob.Spec.Action == provisioning.JobActionPull &&
					deserializedJob.Status.State == provisioning.JobStateSuccess
			}),
		).Return(nil)

		// Execute WriteJob (using the integration job)
		err := history.WriteJob(context.Background(), integrationJob)
		require.NoError(t, err)
	})

	t.Run("WriteJob handles push errors", func(t *testing.T) {
		// Create a simple job for this test
		testJob := &provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "error-job",
				Namespace: "test-namespace",
				UID:       types.UID("error-uid"),
			},
			Spec: provisioning.JobSpec{
				Action:     provisioning.JobActionPull,
				Repository: "test-repo",
			},
			Status: provisioning.JobStatus{
				State: provisioning.JobStateError,
			},
		}

		mockClient := NewMockLokiClient(t)
		history := &LokiJobHistory{
			client:         mockClient,
			externalLabels: map[string]string{},
		}

		// Set up mock to return error
		mockClient.EXPECT().Push(
			mock.MatchedBy(func(ctx context.Context) bool { return true }),
			mock.MatchedBy(func(streams []loki.Stream) bool { return true }),
		).Return(errors.New("loki push failed"))

		// Execute WriteJob and expect error
		err := history.WriteJob(context.Background(), testJob)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to save job history")
		assert.Contains(t, err.Error(), "loki push failed")
	})
}

func TestLokiJobHistory_RecentJobs(t *testing.T) {
	t.Run("RecentJobs returns parsed jobs from Loki", func(t *testing.T) {
		mockClient := NewMockLokiClient(t)
		history := &LokiJobHistory{
			client:         mockClient,
			externalLabels: map[string]string{},
		}

		// Create test job JSON data
		testJob := &provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "recent-job",
				Namespace: "test-ns",
				UID:       types.UID("recent-uid"),
			},
			Spec: provisioning.JobSpec{
				Action:     provisioning.JobActionPull,
				Repository: "test-repo",
			},
			Status: provisioning.JobStatus{
				State:    provisioning.JobStateSuccess,
				Started:  time.Now().UnixMilli() - 50000,
				Finished: time.Now().UnixMilli(),
				Message:  "Success",
			},
		}
		jobJSON, _ := json.Marshal(testJob)

		// Mock Loki response
		mockResult := loki.QueryRes{
			Data: loki.QueryData{
				Result: []loki.Stream{{
					Stream: map[string]string{
						JobHistoryLabelKey: JobHistoryLabelValue,
						NamespaceLabel:     "test-ns",
						RepositoryLabel:    "test-repo",
					},
					Values: []loki.Sample{{
						T: time.Now(),
						V: string(jobJSON),
					}},
				}},
			},
		}

		// Set up mock expectation
		mockClient.EXPECT().RangeQuery(
			mock.MatchedBy(func(ctx context.Context) bool { return true }),
			`{from="job-history",namespace="test-ns",repository="test-repo"}`,
			mock.MatchedBy(func(start int64) bool { return start > 0 }),
			mock.MatchedBy(func(end int64) bool { return end > 0 }),
			int64(10),
		).Return(mockResult, nil)

		// Execute RecentJobs
		result, err := history.RecentJobs(context.Background(), "test-ns", "test-repo")
		require.NoError(t, err)
		require.NotNil(t, result)
		require.Len(t, result.Items, 1)

		// Verify returned job
		returnedJob := result.Items[0]
		assert.Equal(t, "recent-job", returnedJob.Name)
		assert.Equal(t, "test-ns", returnedJob.Namespace)
		assert.Equal(t, types.UID("recent-uid"), returnedJob.UID)
		assert.Equal(t, provisioning.JobActionPull, returnedJob.Spec.Action)
		assert.Equal(t, "test-repo", returnedJob.Spec.Repository)
		assert.Equal(t, provisioning.JobStateSuccess, returnedJob.Status.State)
	})

	t.Run("RecentJobs handles Loki query errors", func(t *testing.T) {
		mockClient := NewMockLokiClient(t)
		history := &LokiJobHistory{
			client:         mockClient,
			externalLabels: map[string]string{},
		}

		// Set up mock to return error
		mockClient.EXPECT().RangeQuery(
			mock.MatchedBy(func(ctx context.Context) bool { return true }),
			mock.MatchedBy(func(query string) bool { return true }),
			mock.MatchedBy(func(start int64) bool { return true }),
			mock.MatchedBy(func(end int64) bool { return true }),
			mock.MatchedBy(func(limit int64) bool { return true }),
		).Return(loki.QueryRes{}, errors.New("loki query failed"))

		// Execute RecentJobs and expect error
		result, err := history.RecentJobs(context.Background(), "test-ns", "test-repo")
		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "failed to query job history")
		assert.Contains(t, err.Error(), "loki query failed")
	})

	t.Run("RecentJobs handles invalid JSON gracefully", func(t *testing.T) {
		mockClient := NewMockLokiClient(t)
		history := &LokiJobHistory{
			client:         mockClient,
			externalLabels: map[string]string{},
		}

		// Mock Loki response with invalid JSON
		mockResult := loki.QueryRes{
			Data: loki.QueryData{
				Result: []loki.Stream{{
					Stream: map[string]string{
						JobHistoryLabelKey: JobHistoryLabelValue,
						NamespaceLabel:     "test-ns",
						RepositoryLabel:    "test-repo",
					},
					Values: []loki.Sample{{
						T: time.Now(),
						V: "invalid-json",
					}},
				}},
			},
		}

		// Set up mock expectation
		mockClient.EXPECT().RangeQuery(
			mock.MatchedBy(func(ctx context.Context) bool { return true }),
			mock.MatchedBy(func(query string) bool { return true }),
			mock.MatchedBy(func(start int64) bool { return true }),
			mock.MatchedBy(func(end int64) bool { return true }),
			mock.MatchedBy(func(limit int64) bool { return true }),
		).Return(mockResult, nil)

		// Execute RecentJobs - should handle invalid JSON gracefully
		result, err := history.RecentJobs(context.Background(), "test-ns", "test-repo")
		require.NoError(t, err)
		require.NotNil(t, result)
		// Invalid JSON entries should be skipped
		assert.Len(t, result.Items, 0)
	})
}

func TestLokiJobHistory_GetJob(t *testing.T) {
	t.Run("GetJob finds job by UID", func(t *testing.T) {
		mockClient := NewMockLokiClient(t)
		history := &LokiJobHistory{
			client:         mockClient,
			externalLabels: map[string]string{},
		}

		// Create test jobs
		job1 := &provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "job-1",
				Namespace: "test-ns",
				UID:       types.UID("uid-1"),
			},
			Spec:   provisioning.JobSpec{Action: provisioning.JobActionPull, Repository: "test-repo"},
			Status: provisioning.JobStatus{State: provisioning.JobStateSuccess},
		}
		job2 := &provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "job-2",
				Namespace: "test-ns",
				UID:       types.UID("target-uid"),
			},
			Spec:   provisioning.JobSpec{Action: provisioning.JobActionPush, Repository: "test-repo"},
			Status: provisioning.JobStatus{State: provisioning.JobStateSuccess},
		}

		job1JSON, _ := json.Marshal(job1)
		job2JSON, _ := json.Marshal(job2)

		// Mock Loki response with multiple jobs
		mockResult := loki.QueryRes{
			Data: loki.QueryData{
				Result: []loki.Stream{{
					Values: []loki.Sample{
						{T: time.Now(), V: string(job1JSON)},
						{T: time.Now(), V: string(job2JSON)},
					},
				}},
			},
		}

		// Set up mock expectation
		mockClient.EXPECT().RangeQuery(
			mock.MatchedBy(func(ctx context.Context) bool { return true }),
			mock.MatchedBy(func(query string) bool { return true }),
			mock.MatchedBy(func(start int64) bool { return true }),
			mock.MatchedBy(func(end int64) bool { return true }),
			mock.MatchedBy(func(limit int64) bool { return true }),
		).Return(mockResult, nil)

		// Execute GetJob
		result, err := history.GetJob(context.Background(), "test-ns", "test-repo", "target-uid")
		require.NoError(t, err)
		require.NotNil(t, result)

		// Verify correct job was returned
		assert.Equal(t, "job-2", result.Name)
		assert.Equal(t, types.UID("target-uid"), result.UID)
		assert.Equal(t, provisioning.JobActionPush, result.Spec.Action)
	})

	t.Run("GetJob returns NotFound for missing UID", func(t *testing.T) {
		mockClient := NewMockLokiClient(t)
		history := &LokiJobHistory{
			client:         mockClient,
			externalLabels: map[string]string{},
		}

		// Mock empty Loki response
		mockResult := loki.QueryRes{
			Data: loki.QueryData{
				Result: []loki.Stream{},
			},
		}

		// Set up mock expectation
		mockClient.EXPECT().RangeQuery(
			mock.MatchedBy(func(ctx context.Context) bool { return true }),
			mock.MatchedBy(func(query string) bool { return true }),
			mock.MatchedBy(func(start int64) bool { return true }),
			mock.MatchedBy(func(end int64) bool { return true }),
			mock.MatchedBy(func(limit int64) bool { return true }),
		).Return(mockResult, nil)

		// Execute GetJob
		result, err := history.GetJob(context.Background(), "test-ns", "test-repo", "missing-uid")
		require.Error(t, err)
		assert.Nil(t, result)

		// Verify it's a NotFound error
		assert.True(t, apierrors.IsNotFound(err))
	})
}

// createTestLokiJobHistory creates a LokiJobHistory for testing
func createTestLokiJobHistory(t *testing.T) *LokiJobHistory {
	// Create test URLs
	readURL, _ := url.Parse("http://localhost:3100")
	writeURL, _ := url.Parse("http://localhost:3100")

	config := loki.Config{
		ReadPathURL:  readURL,
		WritePathURL: writeURL,
		ExternalLabels: map[string]string{
			"test-key": "test-value",
		},
		MaxQuerySize: 1000,
	}

	return NewLokiJobHistory(config)
}
