package source_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/source/sourceserver"
)

func writableRepo(t *testing.T, files map[string][]byte) (repository.ReaderWriter, repository.Versioned) {
	t.Helper()
	_, url, _ := startSource(t, sourceserver.Options{Writable: true, Tier: sourceserver.TierCompare}, files)
	repo := build(t, url, token)
	return repo.(repository.ReaderWriter), repo.(repository.Versioned)
}

func treePaths(t *testing.T, r repository.Reader) []string {
	t.Helper()
	tree, err := r.ReadTree(context.Background(), "")
	require.NoError(t, err)
	var out []string
	for _, e := range tree {
		if e.Blob {
			out = append(out, e.Path)
		}
	}
	return out
}

func content(t *testing.T, r repository.Reader, path string) string {
	t.Helper()
	info, err := r.Read(context.Background(), path, "")
	require.NoError(t, err)
	return string(info.Data)
}

func TestWriterCreateUpdateWrite(t *testing.T) {
	ctx := context.Background()
	rw, versioned := writableRepo(t, manifests("a.yaml", "one"))
	before, err := versioned.LatestRef(ctx)
	require.NoError(t, err)

	t.Run("create writes a new file and moves the revision", func(t *testing.T) {
		require.NoError(t, rw.Create(ctx, "dashboards/b.yaml", "", []byte("bee"), "add b"))
		assert.Equal(t, "bee", content(t, rw, "dashboards/b.yaml"))

		after, err := versioned.LatestRef(ctx)
		require.NoError(t, err)
		assert.NotEqual(t, before, after, "an edit is a new revision, which is what the next sync compares against")
	})

	t.Run("create refuses an existing file", func(t *testing.T) {
		err := rw.Create(ctx, "a.yaml", "", []byte("other"), "")
		assert.ErrorIs(t, err, repository.ErrFileAlreadyExists)
		assert.Equal(t, "one", content(t, rw, "a.yaml"))
	})

	t.Run("update replaces an existing file only", func(t *testing.T) {
		require.NoError(t, rw.Update(ctx, "a.yaml", "", []byte("two"), ""))
		assert.Equal(t, "two", content(t, rw, "a.yaml"))

		assert.ErrorIs(t, rw.Update(ctx, "missing.yaml", "", []byte("x"), ""), repository.ErrFileNotFound)
	})

	t.Run("write creates or replaces", func(t *testing.T) {
		require.NoError(t, rw.Write(ctx, "c.yaml", "", []byte("first"), ""))
		require.NoError(t, rw.Write(ctx, "c.yaml", "", []byte("second"), ""))
		assert.Equal(t, "second", content(t, rw, "c.yaml"))
	})

	t.Run("a directory is a .keep marker", func(t *testing.T) {
		require.NoError(t, rw.Create(ctx, "empty/", "", nil, ""))
		assert.Contains(t, treePaths(t, rw), "empty/.keep")

		err := rw.Create(ctx, "other/", "", []byte("data"), "")
		assert.True(t, apierrors.IsBadRequest(err), "%v", err)
	})

	t.Run("a directory cannot be updated", func(t *testing.T) {
		assert.True(t, apierrors.IsBadRequest(rw.Update(ctx, "empty/", "", nil, "")))
	})

	t.Run("a source has no branches", func(t *testing.T) {
		err := rw.Write(ctx, "d.yaml", "main", []byte("x"), "")
		assert.True(t, apierrors.IsBadRequest(err), "%v", err)
		assert.NotContains(t, treePaths(t, rw), "d.yaml")
	})
}

func TestWriterDeleteAndMove(t *testing.T) {
	ctx := context.Background()
	seed := manifests("a.yaml", "a", "dir/x.yaml", "x", "dir/sub/y.yaml", "y", "other/z.yaml", "z")

	t.Run("delete a file", func(t *testing.T) {
		rw, _ := writableRepo(t, seed)
		require.NoError(t, rw.Delete(ctx, "a.yaml", "", ""))
		assert.NotContains(t, treePaths(t, rw), "a.yaml")
		assert.ErrorIs(t, rw.Delete(ctx, "a.yaml", "", ""), repository.ErrFileNotFound)
	})

	t.Run("delete a directory removes everything under it", func(t *testing.T) {
		rw, _ := writableRepo(t, seed)
		require.NoError(t, rw.Delete(ctx, "dir/", "", ""))
		assert.ElementsMatch(t, []string{"a.yaml", "other/z.yaml"}, treePaths(t, rw))
	})

	t.Run("move a file", func(t *testing.T) {
		rw, versioned := writableRepo(t, seed)
		before, _ := versioned.LatestRef(ctx)

		require.NoError(t, rw.Move(ctx, "a.yaml", "renamed/a.yaml", "", ""))
		assert.Contains(t, treePaths(t, rw), "renamed/a.yaml")
		assert.NotContains(t, treePaths(t, rw), "a.yaml")

		after, _ := versioned.LatestRef(ctx)
		assert.NotEqual(t, before, after)
	})

	t.Run("move a directory", func(t *testing.T) {
		rw, _ := writableRepo(t, seed)
		require.NoError(t, rw.Move(ctx, "dir/", "moved/", "", ""))
		assert.ElementsMatch(t, []string{"a.yaml", "moved/x.yaml", "moved/sub/y.yaml", "other/z.yaml"}, treePaths(t, rw))
	})

	t.Run("move refuses an existing destination and a missing source", func(t *testing.T) {
		rw, _ := writableRepo(t, seed)
		assert.ErrorIs(t, rw.Move(ctx, "a.yaml", "other/z.yaml", "", ""), repository.ErrFileAlreadyExists)
		assert.ErrorIs(t, rw.Move(ctx, "nope.yaml", "x.yaml", "", ""), repository.ErrFileNotFound)
	})

	t.Run("move does not turn a file into a directory", func(t *testing.T) {
		rw, _ := writableRepo(t, seed)
		assert.True(t, apierrors.IsBadRequest(rw.Move(ctx, "a.yaml", "dir/", "", "")))
	})
}

func TestWriterRefusesASourceThatCannotBeEdited(t *testing.T) {
	ctx := context.Background()
	_, url, _ := startSource(t, sourceserver.Options{}, manifests("a.yaml", "a"))
	rw := build(t, url, token).(repository.ReaderWriter)

	for name, err := range map[string]error{
		"create": rw.Create(ctx, "b.yaml", "", []byte("b"), ""),
		"update": rw.Update(ctx, "a.yaml", "", []byte("b"), ""),
		"write":  rw.Write(ctx, "a.yaml", "", []byte("b"), ""),
		"delete": rw.Delete(ctx, "a.yaml", "", ""),
		"move":   rw.Move(ctx, "a.yaml", "b.yaml", "", ""),
	} {
		assert.True(t, apierrors.IsBadRequest(err), "%s: %v", name, err)
		assert.ErrorContains(t, err, "does not allow edits", name)
	}
	assert.Equal(t, "a", content(t, rw, "a.yaml"), "nothing was written")
}

func TestHealthCheckOfAWriteWorkflow(t *testing.T) {
	enableWrite := func(r *provisioning.Repository) {
		r.Spec.Workflows = []provisioning.Workflow{provisioning.WriteWorkflow}
	}

	t.Run("a writable source is healthy", func(t *testing.T) {
		_, url, _ := startSource(t, sourceserver.Options{Writable: true}, nil)
		repo, err := buildWith(newExtra(), url, enableWrite)
		require.NoError(t, err)

		res, err := repo.Test(context.Background())
		require.NoError(t, err)
		assert.True(t, res.Success)
	})

	t.Run("enabling edits on a source that cannot be edited is reported on the workflows field", func(t *testing.T) {
		_, url, _ := startSource(t, sourceserver.Options{}, nil)
		repo, err := buildWith(newExtra(), url, enableWrite)
		require.NoError(t, err)

		res, err := repo.Test(context.Background())
		require.NoError(t, err)
		assert.False(t, res.Success)
		assert.Equal(t, http.StatusBadRequest, res.Code)
		require.Len(t, res.Errors, 1)
		assert.Equal(t, "spec.workflows", res.Errors[0].Field)
		assert.Contains(t, res.Errors[0].Detail, "does not allow edits")
	})

	t.Run("a read-only repository does not care", func(t *testing.T) {
		_, url, _ := startSource(t, sourceserver.Options{}, nil)
		repo, err := buildWith(newExtra(), url, func(*provisioning.Repository) {})
		require.NoError(t, err)

		res, err := repo.Test(context.Background())
		require.NoError(t, err)
		assert.True(t, res.Success)
	})
}
