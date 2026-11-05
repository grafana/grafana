package v1

import (
	"bytes"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	apimachineryvalidation "k8s.io/apimachinery/pkg/api/validation"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

func TestCascadeDeleteFinalizer(t *testing.T) {
	require.Equal(t, "folder.grafana.app/controller-cascade-delete", CascadeDeleteFinalizer)
	require.Empty(t, apimachineryvalidation.ValidateFinalizerName(CascadeDeleteFinalizer, field.NewPath("metadata", "finalizers")))
}

func TestFolderStatusJSON(t *testing.T) {
	t.Run("empty status has no cascadeDelete", func(t *testing.T) {
		b, err := json.Marshal(NewFolder())
		require.NoError(t, err)

		var obj map[string]any
		require.NoError(t, json.Unmarshal(b, &obj))
		require.Equal(t, map[string]any{}, obj["status"])
	})

	t.Run("populated status round-trips through the codec", func(t *testing.T) {
		f := NewFolder()
		f.Name = "abc"
		f.Status.CascadeDelete = &FolderCascadeDeleteStatus{
			State:     FolderCascadeDeleteStatusStateInProgress,
			Total:     new(int64(5)),
			Remaining: new(int64(3)),
			Errors:    []string{"dashboards/d1: boom"},
			Started:   new(int64(1700000000000)),
		}

		codec := &FolderJSONCodec{}
		buf := &bytes.Buffer{}
		require.NoError(t, codec.Write(buf, f))
		require.Contains(t, buf.String(), `"state":"InProgress"`)
		require.Contains(t, buf.String(), `"started":1700000000000`)
		require.Contains(t, buf.String(), `"remaining":3`)
		require.NotContains(t, buf.String(), `"finished"`)

		decoded := NewFolder()
		require.NoError(t, codec.Read(bytes.NewReader(buf.Bytes()), decoded))
		require.Equal(t, f.Status, decoded.Status)

		s, ok := f.GetSubresource("status")
		require.True(t, ok)
		require.Equal(t, f.Status, s)
	})
}
