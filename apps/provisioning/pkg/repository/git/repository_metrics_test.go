package git

import (
	"context"
	"errors"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/nanogit"
	"github.com/grafana/nanogit/mocks"
	"github.com/grafana/nanogit/protocol"
	"github.com/grafana/nanogit/protocol/hash"
)

// The metrics singleton binds to the first registry it is given, so the whole
// test binary shares this one.
var (
	metricsRegistry = prometheus.NewRegistry()
	testMetrics     = repository.RegisterOperationMetrics(metricsRegistry)
)

func newMetricsRepo(t *testing.T, repoType provisioning.RepositoryType, client nanogit.Client) *gitRepository {
	t.Helper()
	return &gitRepository{
		client:    client,
		gitConfig: RepositoryConfig{Branch: "main", Path: "configs"},
		config: &provisioning.Repository{
			Spec: provisioning.RepositorySpec{Type: repoType},
		},
		metrics: testMetrics.Recorder(repoType),
	}
}

// writableClient returns a client whose staged writer accepts every write.
func writableClient() *mocks.FakeClient {
	client := &mocks.FakeClient{}
	client.GetRefReturns(nanogit.Ref{Name: "refs/heads/main", Hash: hash.Hash{}}, nil)
	writer := &mocks.FakeStagedWriter{}
	writer.CreateBlobReturns(hash.Hash{}, nil)
	writer.UpdateBlobReturns(hash.Hash{}, nil)
	writer.DeleteBlobReturns(hash.Hash{}, nil)
	writer.CommitReturns(&nanogit.Commit{}, nil)
	writer.PushReturns(nil)
	client.NewStagedWriterReturns(writer, nil)
	return client
}

// TestGitRepository_OperationMetrics pins the contract that callers rely on:
// every operation on the repository interface is observed once, by the
// repository itself, with no help from the caller.
func TestGitRepository_OperationMetrics(t *testing.T) {
	ctx := context.Background()

	t.Run("read", func(t *testing.T) {
		client := &mocks.FakeClient{}
		client.GetRefReturns(nanogit.Ref{Name: "refs/heads/main", Hash: hash.Hash{}}, nil)
		client.GetCommitReturns(&nanogit.Commit{Tree: hash.Hash{}}, nil)
		client.GetBlobByPathReturns(&nanogit.Blob{Content: []byte("0123456789")}, nil)
		repo := newMetricsRepo(t, provisioning.GitRepositoryType, client)

		before := gitSnapshot(t, provisioning.GitRepositoryType)
		_, err := repo.Read(ctx, "test.yaml", "main")
		require.NoError(t, err)
		after := gitSnapshot(t, provisioning.GitRepositoryType)

		assert.Equal(t, 1.0, after.count(repository.OperationRead, "success")-before.count(repository.OperationRead, "success"))
		assert.Equal(t, 10.0, after.size(repository.OperationRead)-before.size(repository.OperationRead))
	})

	t.Run("failed read", func(t *testing.T) {
		client := &mocks.FakeClient{}
		client.GetRefReturns(nanogit.Ref{Name: "refs/heads/main", Hash: hash.Hash{}}, nil)
		client.GetCommitReturns(&nanogit.Commit{Tree: hash.Hash{}}, nil)
		client.GetBlobByPathReturns(nil, nanogit.ErrObjectNotFound)
		repo := newMetricsRepo(t, provisioning.GitRepositoryType, client)

		before := gitSnapshot(t, provisioning.GitRepositoryType)
		_, err := repo.Read(ctx, "missing.yaml", "main")
		require.ErrorIs(t, err, repository.ErrFileNotFound)
		after := gitSnapshot(t, provisioning.GitRepositoryType)

		assert.Equal(t, 1.0, after.count(repository.OperationRead, "error")-before.count(repository.OperationRead, "error"))
		assert.Equal(t, 0.0, after.size(repository.OperationRead)-before.size(repository.OperationRead),
			"a failed read has no size to report")
	})

	t.Run("list", func(t *testing.T) {
		client := &mocks.FakeClient{}
		client.GetRefReturns(nanogit.Ref{Name: "refs/heads/main", Hash: hash.Hash{}}, nil)
		client.GetFlatTreeReturns(&nanogit.FlatTree{Entries: []nanogit.FlatTreeEntry{{
			Path: "configs/test.yaml", Hash: hash.Hash{}, Type: protocol.ObjectTypeBlob,
		}}}, nil)
		repo := newMetricsRepo(t, provisioning.GitRepositoryType, client)

		before := gitSnapshot(t, provisioning.GitRepositoryType)
		_, err := repo.ReadTree(ctx, "main")
		require.NoError(t, err)
		after := gitSnapshot(t, provisioning.GitRepositoryType)

		assert.Equal(t, 1.0, after.count(repository.OperationList, "success")-before.count(repository.OperationList, "success"))
	})

	t.Run("create, update, delete and move", func(t *testing.T) {
		repo := newMetricsRepo(t, provisioning.GitRepositoryType, writableClient())

		before := gitSnapshot(t, provisioning.GitRepositoryType)
		require.NoError(t, repo.Create(ctx, "test.yaml", "main", []byte("0123456789"), "create"))
		require.NoError(t, repo.Update(ctx, "test.yaml", "main", []byte("updated"), "update"))
		require.NoError(t, repo.Delete(ctx, "test.yaml", "main", "delete"))
		require.NoError(t, repo.Move(ctx, "test.yaml", "moved.yaml", "main", "move"))
		after := gitSnapshot(t, provisioning.GitRepositoryType)

		assert.Equal(t, 2.0, after.count(repository.OperationWrite, "success")-before.count(repository.OperationWrite, "success"))
		assert.Equal(t, 17.0, after.size(repository.OperationWrite)-before.size(repository.OperationWrite))
		assert.Equal(t, 1.0, after.count(repository.OperationDelete, "success")-before.count(repository.OperationDelete, "success"))
		assert.Equal(t, 1.0, after.count(repository.OperationMove, "success")-before.count(repository.OperationMove, "success"))
	})

	// Write delegates to Read plus Create, so it must not add a write of its own
	// on top of the one Create already records.
	t.Run("write is counted once, by the operation it delegates to", func(t *testing.T) {
		client := writableClient()
		client.GetCommitReturns(&nanogit.Commit{Tree: hash.Hash{}}, nil)
		client.GetBlobByPathReturns(nil, nanogit.ErrObjectNotFound)
		repo := newMetricsRepo(t, provisioning.GitRepositoryType, client)

		before := gitSnapshot(t, provisioning.GitRepositoryType)
		require.NoError(t, repo.Write(ctx, "new.yaml", "main", []byte("written"), "write"))
		after := gitSnapshot(t, provisioning.GitRepositoryType)

		assert.Equal(t, 1.0, after.count(repository.OperationWrite, "success")-before.count(repository.OperationWrite, "success"))
		assert.Equal(t, 7.0, after.size(repository.OperationWrite)-before.size(repository.OperationWrite))
		assert.Equal(t, 1.0, after.count(repository.OperationRead, "error")-before.count(repository.OperationRead, "error"),
			"the existence check is the read it performed")
	})

	t.Run("labels follow the configured repository type", func(t *testing.T) {
		repo := newMetricsRepo(t, provisioning.GitHubRepositoryType, writableClient())

		before := gitSnapshot(t, provisioning.GitHubRepositoryType)
		require.NoError(t, repo.Delete(ctx, "test.yaml", "main", "delete"))
		after := gitSnapshot(t, provisioning.GitHubRepositoryType)

		assert.Equal(t, 1.0, after.count(repository.OperationDelete, "success")-before.count(repository.OperationDelete, "success"))
	})
}

func TestStagedGitRepository_OperationMetrics(t *testing.T) {
	ctx := context.Background()
	repo := newMetricsRepo(t, provisioning.GitRepositoryType, writableClient())

	// StageModeCommitOnlyOnce defers the commit to Push, so the writes below
	// only touch the staged writer.
	staged, err := NewStagedGitRepository(ctx, repo, repository.StageOptions{
		Ref:  "main",
		Mode: repository.StageModeCommitOnlyOnce,
	})
	require.NoError(t, err)

	before := gitSnapshot(t, provisioning.GitRepositoryType)
	require.NoError(t, staged.Create(ctx, "test.yaml", "main", []byte("0123456789"), "create"))
	require.NoError(t, staged.Update(ctx, "test.yaml", "main", []byte("updated"), "update"))
	require.NoError(t, staged.Delete(ctx, "test.yaml", "main", "delete"))
	require.NoError(t, staged.Move(ctx, "test.yaml", "moved.yaml", "main", "move"))
	after := gitSnapshot(t, provisioning.GitRepositoryType)

	assert.Equal(t, 2.0, after.count(repository.OperationWrite, "success")-before.count(repository.OperationWrite, "success"))
	assert.Equal(t, 17.0, after.size(repository.OperationWrite)-before.size(repository.OperationWrite))
	assert.Equal(t, 1.0, after.count(repository.OperationDelete, "success")-before.count(repository.OperationDelete, "success"))
	assert.Equal(t, 1.0, after.count(repository.OperationMove, "success")-before.count(repository.OperationMove, "success"))
	assert.Equal(t, 0.0, after.count(repository.OperationPush, "success")-before.count(repository.OperationPush, "success"),
		"StageModeCommitOnlyOnce defers the remote round trip to Push")
}

// A staged write only stages a blob; the writes reach the remote in Push. These
// pin that Push is where that outcome and latency are observed, so a batch that
// never landed is visible even though its staged writes succeeded.
func TestStagedGitRepository_PushMetrics(t *testing.T) {
	ctx := context.Background()

	newStaged := func(t *testing.T, client *mocks.FakeClient) repository.StagedRepository {
		t.Helper()
		repo := newMetricsRepo(t, provisioning.GitRepositoryType, client)
		staged, err := NewStagedGitRepository(ctx, repo, repository.StageOptions{
			Ref:  "main",
			Mode: repository.StageModeCommitOnlyOnce,
		})
		require.NoError(t, err)
		return staged
	}

	t.Run("a successful push is recorded", func(t *testing.T) {
		staged := newStaged(t, writableClient())

		before := gitSnapshot(t, provisioning.GitRepositoryType)
		require.NoError(t, staged.Push(ctx))
		after := gitSnapshot(t, provisioning.GitRepositoryType)

		assert.Equal(t, 1.0, after.count(repository.OperationPush, "success")-before.count(repository.OperationPush, "success"))
	})

	t.Run("a failed push is recorded as an error, even though the staged write succeeded", func(t *testing.T) {
		client := writableClient()
		writer := &mocks.FakeStagedWriter{}
		writer.CreateBlobReturns(hash.Hash{}, nil)
		writer.CommitReturns(&nanogit.Commit{}, nil)
		writer.PushReturns(errors.New("remote rejected"))
		client.NewStagedWriterReturns(writer, nil)
		staged := newStaged(t, client)

		before := gitSnapshot(t, provisioning.GitRepositoryType)
		require.NoError(t, staged.Create(ctx, "test.yaml", "main", []byte("staged"), "create"))
		require.Error(t, staged.Push(ctx))
		after := gitSnapshot(t, provisioning.GitRepositoryType)

		assert.Equal(t, 1.0, after.count(repository.OperationWrite, "success")-before.count(repository.OperationWrite, "success"),
			"staging the blob did succeed")
		assert.Equal(t, 1.0, after.count(repository.OperationPush, "error")-before.count(repository.OperationPush, "error"),
			"the batch not reaching the remote is what shows up as a failure")
	})

	t.Run("a push with nothing to send is not a failure", func(t *testing.T) {
		for _, tt := range []struct {
			name string
			err  error
		}{
			{"nothing to push", nanogit.ErrNothingToPush},
			{"nothing to commit", nanogit.ErrNothingToCommit},
		} {
			t.Run(tt.name, func(t *testing.T) {
				client := writableClient()
				writer := &mocks.FakeStagedWriter{}
				writer.CommitReturns(&nanogit.Commit{}, nil)
				writer.PushReturns(tt.err)
				client.NewStagedWriterReturns(writer, nil)
				staged := newStaged(t, client)

				before := gitSnapshot(t, provisioning.GitRepositoryType)
				require.Error(t, staged.Push(ctx))
				after := gitSnapshot(t, provisioning.GitRepositoryType)

				assert.Equal(t, 1.0, after.count(repository.OperationPush, "success")-before.count(repository.OperationPush, "success"))
				assert.Equal(t, 0.0, after.count(repository.OperationPush, "error")-before.count(repository.OperationPush, "error"))
			})
		}
	})
}

// metricSnapshot holds the operation samples for one repository type at a point
// in time, so assertions can be made on deltas rather than absolute values.
type metricSnapshot struct {
	counts map[string]float64
	sizes  map[string]float64
}

func (s metricSnapshot) count(operation, outcome string) float64 {
	return s.counts[operation+"/"+outcome]
}

func (s metricSnapshot) size(operation string) float64 {
	return s.sizes[operation]
}

func gitSnapshot(t *testing.T, repoType provisioning.RepositoryType) metricSnapshot {
	t.Helper()
	families, err := metricsRegistry.Gather()
	require.NoError(t, err)

	out := metricSnapshot{counts: map[string]float64{}, sizes: map[string]float64{}}
	for _, f := range families {
		for _, m := range f.GetMetric() {
			labels := map[string]string{}
			for _, l := range m.GetLabel() {
				labels[l.GetName()] = l.GetValue()
			}
			if labels["repository_type"] != string(repoType) {
				continue
			}
			switch f.GetName() {
			case "grafana_provisioning_repository_operations_total":
				out.counts[labels["operation"]+"/"+labels["outcome"]] = m.GetCounter().GetValue()
			case "grafana_provisioning_repository_operation_size_bytes":
				out.sizes[labels["operation"]] = m.GetHistogram().GetSampleSum()
			}
		}
	}
	return out
}
