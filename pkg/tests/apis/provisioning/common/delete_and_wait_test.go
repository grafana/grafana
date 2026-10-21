package common

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
)

// fakeResourceClient lists and deletes named items. deleteErrs holds, per name, the errors the
// next deletes return before one succeeds.
type fakeResourceClient struct {
	dynamic.ResourceInterface
	mu         sync.Mutex
	items      map[string]bool
	deleteErrs map[string][]error
	deletes    int
}

func newFakeResourceClient(names ...string) *fakeResourceClient {
	f := &fakeResourceClient{items: map[string]bool{}, deleteErrs: map[string][]error{}}
	for _, name := range names {
		f.items[name] = true
	}
	return f
}

func (f *fakeResourceClient) List(context.Context, metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	list := &unstructured.UnstructuredList{}
	for name := range f.items {
		item := unstructured.Unstructured{}
		item.SetName(name)
		list.Items = append(list.Items, item)
	}
	return list, nil
}

func (f *fakeResourceClient) Delete(_ context.Context, name string, _ metav1.DeleteOptions, _ ...string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.deletes++
	if errs := f.deleteErrs[name]; len(errs) > 0 {
		f.deleteErrs[name] = errs[1:]
		return errs[0]
	}
	delete(f.items, name)
	return nil
}

func TestDeleteAndWait(t *testing.T) {
	gr := schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}

	t.Run("a failed delete is returned at once, not after the timeout", func(t *testing.T) {
		client := newFakeResourceClient("stuck")
		client.deleteErrs["stuck"] = []error{errors.New("managed resource is missing source path annotation")}

		start := time.Now()
		err := deleteAndWait(t.Context(), client, time.Minute, metav1.DeleteOptions{})

		require.Error(t, err)
		require.Contains(t, err.Error(), `"stuck"`)
		require.Contains(t, err.Error(), "missing source path annotation")
		require.Less(t, time.Since(start), 5*time.Second)
		require.Equal(t, 1, client.deletes, "it must not retry")
	})

	t.Run("a failed delete found while polling is returned at once", func(t *testing.T) {
		client := newFakeResourceClient("a", "b")
		client.deleteErrs["b"] = []error{apierrors.NewForbidden(gr, "b", errors.New("denied"))}

		err := deleteAndWait(t.Context(), client, time.Minute, metav1.DeleteOptions{})

		require.Error(t, err)
		require.True(t, apierrors.IsForbidden(err), "got: %v", err)
	})

	t.Run("transient errors are retried", func(t *testing.T) {
		for name, transient := range map[string]error{
			"conflict":            apierrors.NewConflict(gr, "busy", errors.New("object was modified")),
			"server timeout":      apierrors.NewServerTimeout(gr, "delete", 1),
			"timeout":             apierrors.NewTimeoutError("took too long", 1),
			"too many requests":   apierrors.NewTooManyRequests("slow down", 1),
			"service unavailable": apierrors.NewServiceUnavailable("not ready"),
		} {
			t.Run(name, func(t *testing.T) {
				client := newFakeResourceClient("busy")
				client.deleteErrs["busy"] = []error{transient}

				require.NoError(t, deleteAndWait(t.Context(), client, time.Minute, metav1.DeleteOptions{}))
				require.Empty(t, client.items)
				require.GreaterOrEqual(t, client.deletes, 2)
			})
		}
	})

	t.Run("a transient error that lasts until the timeout is named", func(t *testing.T) {
		client := newFakeResourceClient("busy")
		always := apierrors.NewServiceUnavailable("not ready")
		client.deleteErrs["busy"] = []error{always, always, always, always, always, always, always, always, always, always}

		err := deleteAndWait(t.Context(), client, 300*time.Millisecond, metav1.DeleteOptions{})

		require.Error(t, err)
		require.Contains(t, err.Error(), "timed out")
		require.Contains(t, err.Error(), "not ready")
	})

	t.Run("errors that repeat are not retried", func(t *testing.T) {
		for name, permanent := range map[string]error{
			"forbidden":    apierrors.NewForbidden(gr, "x", errors.New("denied")),
			"unauthorized": apierrors.NewUnauthorized("no"),
			"bad request":  apierrors.NewBadRequest("no"),
			"internal":     apierrors.NewInternalError(errors.New("boom")),
			"plain":        errors.New("boom"),
		} {
			t.Run(name, func(t *testing.T) {
				client := newFakeResourceClient("x")
				client.deleteErrs["x"] = []error{permanent}

				require.Error(t, deleteAndWait(t.Context(), client, time.Minute, metav1.DeleteOptions{}))
				require.Equal(t, 1, client.deletes)
			})
		}
	})

	t.Run("an item that is already gone is not an error", func(t *testing.T) {
		client := newFakeResourceClient("gone")
		client.deleteErrs["gone"] = []error{apierrors.NewNotFound(gr, "gone")}

		require.NoError(t, deleteAndWait(t.Context(), client, time.Minute, metav1.DeleteOptions{}))
	})

	t.Run("nothing to delete", func(t *testing.T) {
		require.NoError(t, deleteAndWait(t.Context(), newFakeResourceClient(), time.Minute, metav1.DeleteOptions{}))
	})
}

func TestDescribeOrphans(t *testing.T) {
	got := describeOrphans(map[string][]string{
		"repo-b": {"Folder/root", "Dashboard/d1"},
		"repo-a": {"Folder/other"},
	})

	require.Equal(t, `repository "repo-a": Folder/other; repository "repo-b": Folder/root, Dashboard/d1`, got)
}
