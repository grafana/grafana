package bootstrap

import (
	"os"
	"path/filepath"
	"testing"
	"testing/fstest"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReadManifests(t *testing.T) {
	t.Run("reads and sorts multiple files, splits multi-doc, defaults namespace", func(t *testing.T) {
		fsys := fstest.MapFS{
			"b-repo.yaml": {Data: []byte(`
apiVersion: provisioning.grafana.app/v0alpha1
kind: Repository
metadata:
  name: repo-b
spec:
  title: B
`)},
			"a-multi.yaml": {Data: []byte(`
apiVersion: provisioning.grafana.app/v0alpha1
kind: Connection
metadata:
  name: conn-a
  namespace: org-2
spec:
  title: A
---
apiVersion: provisioning.grafana.app/v0alpha1
kind: Repository
metadata:
  name: repo-a
spec:
  title: A-repo
`)},
			"ignore.txt": {Data: []byte("not yaml")},
		}

		objs, err := ReadManifests(fsys, ".")
		require.NoError(t, err)
		require.Len(t, objs, 3)

		// Sorted by filename: a-multi.yaml (2 docs) before b-repo.yaml.
		assert.Equal(t, "conn-a", objs[0].GetName())
		assert.Equal(t, "org-2", objs[0].GetNamespace())
		assert.Equal(t, "repo-a", objs[1].GetName())
		assert.Equal(t, defaultNamespace, objs[1].GetNamespace(), "missing namespace should default")
		assert.Equal(t, "repo-b", objs[2].GetName())
	})

	t.Run("empty directory returns no objects", func(t *testing.T) {
		objs, err := ReadManifests(fstest.MapFS{}, ".")
		require.NoError(t, err)
		assert.Empty(t, objs)
	})

	t.Run("missing required fields error", func(t *testing.T) {
		for name, data := range map[string]string{
			"no kind":    "apiVersion: v1\nmetadata:\n  name: x\n",
			"no name":    "apiVersion: v1\nkind: Repository\n",
			"no version": "kind: Repository\nmetadata:\n  name: x\n",
		} {
			t.Run(name, func(t *testing.T) {
				_, err := ReadManifests(fstest.MapFS{"m.yaml": {Data: []byte(data)}}, ".")
				assert.Error(t, err)
			})
		}
	})
}

func TestInterpolate(t *testing.T) {
	t.Run("expands env and file references in string leaves", func(t *testing.T) {
		t.Setenv("GH_PAT", "tok-from-env")

		dir := t.TempDir()
		secretFile := filepath.Join(dir, "key.pem")
		require.NoError(t, os.WriteFile(secretFile, []byte("  pem-from-file\n"), 0600))

		fsys := fstest.MapFS{"m.yaml": {Data: []byte(`
apiVersion: provisioning.grafana.app/v0alpha1
kind: Repository
metadata:
  name: r
spec:
  title: keep-me
  nested:
    list:
      - "$__env{GH_PAT}"
secure:
  token:
    create: "$__env{GH_PAT}"
  key:
    create: "$__file{` + secretFile + `}"
`)}}

		objs, err := ReadManifests(fsys, ".")
		require.NoError(t, err)
		require.Len(t, objs, 1)

		obj := objs[0].Object
		secure := obj["secure"].(map[string]any)
		assert.Equal(t, "tok-from-env", secure["token"].(map[string]any)["create"])
		assert.Equal(t, "pem-from-file", secure["key"].(map[string]any)["create"], "file content should be trimmed")

		spec := obj["spec"].(map[string]any)
		assert.Equal(t, "keep-me", spec["title"], "non-reference strings are untouched")
		list := spec["nested"].(map[string]any)["list"].([]any)
		assert.Equal(t, "tok-from-env", list[0], "references inside slices are expanded")
	})
}
