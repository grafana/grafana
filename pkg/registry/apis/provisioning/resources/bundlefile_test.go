package resources

import (
	"encoding/base64"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func testBundleFile(path, ref string, data []byte) *provisioning.BundleFile {
	return NewBundleFile(BundleFileOptions{
		Namespace:  "stacks-1",
		Repository: "acme-repo",
		Bundle:     "sample",
		Path:       path,
		Ref:        ref,
		Data:       data,
	})
}

func TestNewBundleFile(t *testing.T) {
	data := []byte("# notes\n")
	file := testBundleFile("bundles/sample/docs/a.md", "abc123", data)

	assert.Equal(t, "stacks-1", file.Namespace)
	assert.Equal(t, BundleFileName("sample", "bundles/sample/docs/a.md"), file.Name)
	assert.Equal(t, "acme-repo", file.Labels[provisioning.BundleFileRepositoryLabel])
	assert.Equal(t, "sample", file.Labels[provisioning.BundleFileBundleLabel])

	assert.Equal(t, "bundles/sample/docs/a.md", file.Spec.Path)
	assert.Equal(t, "abc123", file.Spec.Ref)
	assert.Equal(t, int64(len(data)), file.Spec.Size)
	assert.True(t, strings.HasPrefix(file.Spec.Hash, "sha256:"))

	// Content is always base64, whatever the file holds.
	decoded, err := base64.StdEncoding.DecodeString(file.Spec.Content)
	require.NoError(t, err)
	assert.Equal(t, data, decoded)

	roundTripped, err := DecodeBundleFile(file)
	require.NoError(t, err)
	assert.Equal(t, data, roundTripped)
}

func TestNewBundleFile_BinaryContent(t *testing.T) {
	// Invalid UTF-8 survives, which is the reason content is encoded unconditionally.
	data := []byte{0xff, 0xfe, 0x00, 0x01}
	file := testBundleFile("bundles/sample/assets/logo.bin", "abc123", data)

	decoded, err := DecodeBundleFile(file)
	require.NoError(t, err)
	assert.Equal(t, data, decoded)
}

func TestDecodeBundleFile_Invalid(t *testing.T) {
	file := testBundleFile("bundles/sample/a.md", "abc", []byte("ok"))
	file.Spec.Content = "not base64!!"

	_, err := DecodeBundleFile(file)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "bundles/sample/a.md")
}

func TestBundleFileName(t *testing.T) {
	t.Run("is stable and path-specific", func(t *testing.T) {
		a := BundleFileName("sample", "bundles/sample/a.md")
		b := BundleFileName("sample", "bundles/sample/b.md")

		assert.Equal(t, a, BundleFileName("sample", "bundles/sample/a.md"))
		assert.NotEqual(t, a, b)
		assert.True(t, strings.HasPrefix(a, "sample-"))
	})

	t.Run("does not collide across bundles", func(t *testing.T) {
		assert.NotEqual(t,
			BundleFileName("one", "shared/query.sql"),
			BundleFileName("two", "shared/query.sql"),
		)
	})

	t.Run("stays within the resource name limit", func(t *testing.T) {
		name := BundleFileName(strings.Repeat("b", 253), "bundles/sample/a.md")
		assert.LessOrEqual(t, len(name), 253)
	})
}

func TestDiffBundleFiles(t *testing.T) {
	const (
		oldRef = "aaa111"
		newRef = "bbb222"
	)

	t.Run("creates files the bundle does not have", func(t *testing.T) {
		desired := []*provisioning.BundleFile{
			testBundleFile("bundles/sample/a.md", newRef, []byte("a")),
			testBundleFile("bundles/sample/b.md", newRef, []byte("b")),
		}

		got := DiffBundleFiles(nil, desired, newRef)

		assert.Equal(t, newRef, got.Ref)
		assert.Equal(t, 2, got.Count(BundleFileActionCreate))
		assert.Len(t, got.Writes(), 2)
	})

	t.Run("updates content and refreshes a moved ref separately", func(t *testing.T) {
		existing := []*provisioning.BundleFile{
			testBundleFile("bundles/sample/changed.md", oldRef, []byte("before")),
			testBundleFile("bundles/sample/same.md", oldRef, []byte("unchanged")),
		}
		desired := []*provisioning.BundleFile{
			testBundleFile("bundles/sample/changed.md", newRef, []byte("after")),
			testBundleFile("bundles/sample/same.md", newRef, []byte("unchanged")),
		}

		got := DiffBundleFiles(existing, desired, newRef)

		require.Len(t, got.Changes, 2)
		assert.Equal(t, BundleFileActionUpdate, got.Changes[0].Action)
		assert.Equal(t, "bundles/sample/changed.md", got.Changes[0].Path)
		assert.Equal(t, BundleFileActionRefresh, got.Changes[1].Action)
		assert.Equal(t, "bundles/sample/same.md", got.Changes[1].Path)

		// Both are writes: a file carries its own ref, so an unchanged file still has
		// to move or a reader cannot tell it is current.
		assert.Len(t, got.Writes(), 2)
	})

	t.Run("reports an identical file at the same ref as unchanged", func(t *testing.T) {
		existing := []*provisioning.BundleFile{
			testBundleFile("bundles/sample/a.md", newRef, []byte("a")),
		}
		desired := []*provisioning.BundleFile{
			testBundleFile("bundles/sample/a.md", newRef, []byte("a")),
		}

		got := DiffBundleFiles(existing, desired, newRef)

		require.Len(t, got.Changes, 1)
		assert.Equal(t, BundleFileActionUnchanged, got.Changes[0].Action)
		assert.Nil(t, got.Changes[0].File)
		assert.True(t, got.IsEmpty())
	})

	t.Run("deletes files the bundle no longer claims", func(t *testing.T) {
		existing := []*provisioning.BundleFile{
			testBundleFile("bundles/sample/kept.md", oldRef, []byte("kept")),
			testBundleFile("bundles/sample/dropped.md", oldRef, []byte("dropped")),
		}
		desired := []*provisioning.BundleFile{
			testBundleFile("bundles/sample/kept.md", newRef, []byte("kept")),
		}

		got := DiffBundleFiles(existing, desired, newRef)

		require.Len(t, got.Changes, 2)
		assert.Equal(t, BundleFileActionDelete, got.Changes[0].Action)
		assert.Equal(t, "bundles/sample/dropped.md", got.Changes[0].Path)
		assert.Nil(t, got.Changes[0].File)
		assert.Equal(t, BundleFileActionRefresh, got.Changes[1].Action)
	})

	t.Run("never delete-then-creates a file that persists", func(t *testing.T) {
		existing := []*provisioning.BundleFile{
			testBundleFile("bundles/sample/a.md", oldRef, []byte("before")),
		}
		desired := []*provisioning.BundleFile{
			testBundleFile("bundles/sample/a.md", newRef, []byte("after")),
		}

		got := DiffBundleFiles(existing, desired, newRef)

		assert.Zero(t, got.Count(BundleFileActionDelete))
		assert.Zero(t, got.Count(BundleFileActionCreate))
		assert.Equal(t, 1, got.Count(BundleFileActionUpdate))
	})

	t.Run("an emptied bundle deletes everything", func(t *testing.T) {
		existing := []*provisioning.BundleFile{
			testBundleFile("bundles/sample/a.md", oldRef, []byte("a")),
			testBundleFile("bundles/sample/b.md", oldRef, []byte("b")),
		}

		got := DiffBundleFiles(existing, nil, newRef)

		assert.Equal(t, 2, got.Count(BundleFileActionDelete))
	})

	t.Run("changes are ordered by path", func(t *testing.T) {
		desired := []*provisioning.BundleFile{
			testBundleFile("bundles/sample/z.md", newRef, []byte("z")),
			testBundleFile("bundles/sample/a.md", newRef, []byte("a")),
			testBundleFile("bundles/sample/m.md", newRef, []byte("m")),
		}

		got := DiffBundleFiles(nil, desired, newRef)

		require.Len(t, got.Changes, 3)
		assert.Equal(t, "bundles/sample/a.md", got.Changes[0].Path)
		assert.Equal(t, "bundles/sample/m.md", got.Changes[1].Path)
		assert.Equal(t, "bundles/sample/z.md", got.Changes[2].Path)
	})
}

func TestBundleFilesPublishable(t *testing.T) {
	const ref = "bbb222"

	t.Run("true once every file is at the ref", func(t *testing.T) {
		files := []*provisioning.BundleFile{
			testBundleFile("a.md", ref, []byte("a")),
			testBundleFile("b.md", ref, []byte("b")),
		}
		assert.True(t, BundleFilesPublishable(files, ref))
	})

	t.Run("false while any file lags", func(t *testing.T) {
		files := []*provisioning.BundleFile{
			testBundleFile("a.md", ref, []byte("a")),
			testBundleFile("b.md", "aaa111", []byte("b")),
		}
		assert.False(t, BundleFilesPublishable(files, ref))
	})

	t.Run("an empty set is publishable", func(t *testing.T) {
		assert.True(t, BundleFilesPublishable(nil, ref))
	})
}
