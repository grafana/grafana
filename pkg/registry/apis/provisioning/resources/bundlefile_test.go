package resources

import (
	"encoding/base64"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func testBundleFile(path string, data []byte) *provisioning.BundleFile {
	return NewBundleFile(BundleFileOptions{
		Namespace:  "stacks-1",
		Repository: "acme-repo",
		Bundle:     "sample",
		Path:       path,
		Data:       data,
	})
}

func TestNewBundleFile(t *testing.T) {
	data := []byte("# notes\n")
	file := testBundleFile("bundles/sample/docs/a.md", data)

	assert.Equal(t, "stacks-1", file.Namespace)
	assert.Equal(t, BundleFileName("sample", "bundles/sample/docs/a.md"), file.Name)
	assert.Equal(t, "acme-repo", file.Labels[provisioning.BundleFileRepositoryLabel])
	assert.Equal(t, "sample", file.Labels[provisioning.BundleLabel])
	assert.Equal(t, "sample", file.Spec.Bundle)

	// Files are foldered under their bundle so a folder view groups them under it.
	meta, err := utils.MetaAccessor(file)
	require.NoError(t, err)
	assert.Equal(t, BundleFolderID("sample", "acme-repo"), meta.GetFolder())

	assert.Equal(t, "bundles/sample/docs/a.md", file.Spec.Path)
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
	file := testBundleFile("bundles/sample/assets/logo.bin", data)

	decoded, err := DecodeBundleFile(file)
	require.NoError(t, err)
	assert.Equal(t, data, decoded)
}

func TestNewBundleFile_HashTracksContent(t *testing.T) {
	// The hash is the only version marker, so identical content must hash identically
	// and changed content must not.
	same := testBundleFile("a.md", []byte("one"))
	alsoSame := testBundleFile("a.md", []byte("one"))
	changed := testBundleFile("a.md", []byte("two"))

	assert.Equal(t, same.Spec.Hash, alsoSame.Spec.Hash)
	assert.NotEqual(t, same.Spec.Hash, changed.Spec.Hash)
}

func TestDecodeBundleFile_Invalid(t *testing.T) {
	file := testBundleFile("bundles/sample/a.md", []byte("ok"))
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

	t.Run("gives each bundle its own copy of a shared path", func(t *testing.T) {
		// Files are not shared: two bundles declaring the same repository path each
		// store their own, so deletion stays per bundle.
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

func TestBundleFolderID(t *testing.T) {
	t.Run("is stable and bundle-specific", func(t *testing.T) {
		a := BundleFolderID("sample", "acme-repo")

		assert.Equal(t, a, BundleFolderID("sample", "acme-repo"))
		assert.NotEqual(t, a, BundleFolderID("other", "acme-repo"))
	})

	t.Run("is scoped to the repository", func(t *testing.T) {
		// Two repositories may each have a bundle named "sample"; their folders must not
		// be the same folder.
		assert.NotEqual(t,
			BundleFolderID("sample", "acme-repo"),
			BundleFolderID("sample", "other-repo"),
		)
	})

	t.Run("cannot collide with a repository directory of the same name", func(t *testing.T) {
		// ParseFolder keys the hash on the directory path; this keys it on
		// "bundle/<name>", so a directory literally called "sample" lands elsewhere.
		assert.NotEqual(t,
			BundleFolderID("sample", "acme-repo"),
			ParseFolder("sample", "acme-repo").ID,
		)
	})

	t.Run("is a valid folder UID", func(t *testing.T) {
		id := BundleFolderID(strings.Repeat("b", 120), "acme-repo")

		assert.LessOrEqual(t, len(id), 40, "UIDs are capped at 40 characters")
		assert.Equal(t, id, sanitiseKubeName(id), "must already be a valid Kubernetes name")
	})
}

func TestDiffBundleFiles(t *testing.T) {
	t.Run("creates files the bundle does not store", func(t *testing.T) {
		desired := []*provisioning.BundleFile{
			testBundleFile("bundles/sample/a.md", []byte("a")),
			testBundleFile("bundles/sample/b.md", []byte("b")),
		}

		got := DiffBundleFiles(nil, desired)

		assert.Equal(t, 2, got.Count(BundleFileActionCreate))
		assert.Len(t, got.Writes(), 2)
	})

	t.Run("updates a file whose content changed", func(t *testing.T) {
		existing := []*provisioning.BundleFile{testBundleFile("a.md", []byte("before"))}
		desired := []*provisioning.BundleFile{testBundleFile("a.md", []byte("after"))}

		got := DiffBundleFiles(existing, desired)

		require.Len(t, got.Changes, 1)
		assert.Equal(t, BundleFileActionUpdate, got.Changes[0].Action)
	})

	t.Run("identical content is unchanged and costs no write", func(t *testing.T) {
		// With the hash as the only version marker, a bundle advancing to a newer ref
		// over unchanged content writes nothing at all.
		existing := []*provisioning.BundleFile{testBundleFile("a.md", []byte("same"))}
		desired := []*provisioning.BundleFile{testBundleFile("a.md", []byte("same"))}

		got := DiffBundleFiles(existing, desired)

		require.Len(t, got.Changes, 1)
		assert.Equal(t, BundleFileActionUnchanged, got.Changes[0].Action)
		assert.Nil(t, got.Changes[0].File)
		assert.True(t, got.IsEmpty())
	})

	t.Run("deletes files the bundle no longer holds", func(t *testing.T) {
		existing := []*provisioning.BundleFile{
			testBundleFile("kept.md", []byte("kept")),
			testBundleFile("dropped.md", []byte("dropped")),
		}
		desired := []*provisioning.BundleFile{testBundleFile("kept.md", []byte("kept"))}

		got := DiffBundleFiles(existing, desired)

		require.Len(t, got.Changes, 2)
		assert.Equal(t, BundleFileActionDelete, got.Changes[0].Action)
		assert.Equal(t, "dropped.md", got.Changes[0].Path)
		assert.Nil(t, got.Changes[0].File)
		assert.Equal(t, BundleFileActionUnchanged, got.Changes[1].Action)
	})

	t.Run("never delete-then-creates a file that persists", func(t *testing.T) {
		existing := []*provisioning.BundleFile{testBundleFile("a.md", []byte("before"))}
		desired := []*provisioning.BundleFile{testBundleFile("a.md", []byte("after"))}

		got := DiffBundleFiles(existing, desired)

		assert.Zero(t, got.Count(BundleFileActionDelete))
		assert.Zero(t, got.Count(BundleFileActionCreate))
		assert.Equal(t, 1, got.Count(BundleFileActionUpdate))
	})

	t.Run("an emptied bundle deletes everything", func(t *testing.T) {
		existing := []*provisioning.BundleFile{
			testBundleFile("a.md", []byte("a")),
			testBundleFile("b.md", []byte("b")),
		}

		got := DiffBundleFiles(existing, nil)

		assert.Equal(t, 2, got.Count(BundleFileActionDelete))
	})

	t.Run("changes are ordered by path", func(t *testing.T) {
		desired := []*provisioning.BundleFile{
			testBundleFile("z.md", []byte("z")),
			testBundleFile("a.md", []byte("a")),
			testBundleFile("m.md", []byte("m")),
		}

		got := DiffBundleFiles(nil, desired)

		require.Len(t, got.Changes, 3)
		assert.Equal(t, "a.md", got.Changes[0].Path)
		assert.Equal(t, "m.md", got.Changes[1].Path)
		assert.Equal(t, "z.md", got.Changes[2].Path)
	})
}

func TestBundleFileRefs(t *testing.T) {
	files := []*provisioning.BundleFile{
		testBundleFile("z.md", []byte("z")),
		testBundleFile("a.md", []byte("a")),
		nil,
	}

	refs := BundleFileRefs(files)

	require.Len(t, refs, 2, "nil entries are skipped")
	assert.Equal(t, "a.md", refs[0].Path, "refs are ordered by path")
	assert.Equal(t, "z.md", refs[1].Path)

	// Each ref names the BundleFile holding it, so a consumer fetches content directly
	// rather than listing or recomputing the name.
	assert.Equal(t, BundleFileName("sample", "a.md"), refs[0].Name)
	assert.Equal(t, files[1].Spec.Hash, refs[0].Hash)
	assert.Equal(t, files[1].Spec.Size, refs[0].Size)
}

func TestBundleFilesPublishable(t *testing.T) {
	a := testBundleFile("a.md", []byte("a"))
	b := testBundleFile("b.md", []byte("b"))
	expected := BundleFileRefs([]*provisioning.BundleFile{a, b})

	t.Run("true once every expected file is stored at its hash", func(t *testing.T) {
		assert.True(t, BundleFilesPublishable([]*provisioning.BundleFile{a, b}, expected))
	})

	t.Run("false while a file is missing", func(t *testing.T) {
		assert.False(t, BundleFilesPublishable([]*provisioning.BundleFile{a}, expected))
	})

	t.Run("false while a file holds different content", func(t *testing.T) {
		stale := testBundleFile("a.md", []byte("older"))
		assert.False(t, BundleFilesPublishable([]*provisioning.BundleFile{stale, b}, expected))
	})

	t.Run("extra stored files do not block publishing", func(t *testing.T) {
		// Only what the bundle resolved has to match.
		only := BundleFileRefs([]*provisioning.BundleFile{a})
		assert.True(t, BundleFilesPublishable([]*provisioning.BundleFile{a, b}, only))
	})

	t.Run("a bundle expecting nothing is publishable", func(t *testing.T) {
		assert.True(t, BundleFilesPublishable(nil, nil))
	})
}
