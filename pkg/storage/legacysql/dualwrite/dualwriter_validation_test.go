package dualwrite

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/apis/example"

	"github.com/grafana/grafana/pkg/apiserver/rest"
)

// TestDualWriter_Create_ValidationErrors covers the input-validation guards in
// dualWriter.Create that fire before any storage is touched.
func TestDualWriter_Create_ValidationErrors(t *testing.T) {
	t.Run("should error when object has a UID preset", func(t *testing.T) {
		ls := &fakeStorage{}
		us := &fakeStorage{}

		dw, err := newStorage(kind, rest.Mode1, ls, us)
		require.NoError(t, err)

		objWithUID := exampleObj.DeepCopyObject().(*example.Pod)
		objWithUID.UID = "preset-uid"

		_, err = dw.Create(context.Background(), objWithUID,
			func(ctx context.Context, obj runtime.Object) error { return nil },
			&metav1.CreateOptions{})
		require.Error(t, err)
		require.Contains(t, err.Error(), "UID should not be")

		// No storage call should have been made
		require.Empty(t, ls.createCalls)
		require.Empty(t, us.createCalls)
	})

	t.Run("should error when object has neither name nor generateName", func(t *testing.T) {
		ls := &fakeStorage{}
		us := &fakeStorage{}

		dw, err := newStorage(kind, rest.Mode1, ls, us)
		require.NoError(t, err)

		nameless := &example.Pod{
			TypeMeta:   metav1.TypeMeta{Kind: "foo"},
			ObjectMeta: metav1.ObjectMeta{},
		}

		_, err = dw.Create(context.Background(), nameless,
			func(ctx context.Context, obj runtime.Object) error { return nil },
			&metav1.CreateOptions{})
		require.Error(t, err)
		require.Contains(t, err.Error(), "name or generatename")

		require.Empty(t, ls.createCalls)
		require.Empty(t, us.createCalls)
	})
}
