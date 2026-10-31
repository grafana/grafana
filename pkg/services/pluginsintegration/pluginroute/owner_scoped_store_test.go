package pluginroute

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func objectNamed(name string) *unstructured.Unstructured {
	u := &unstructured.Unstructured{}
	u.SetName(name)
	return u
}

func namesOf(t *testing.T, objs []runtime.Object) []string {
	t.Helper()
	names := make([]string, 0, len(objs))
	for _, obj := range objs {
		m, err := meta.Accessor(obj)
		require.NoError(t, err)
		names = append(names, m.GetName())
	}
	return names
}

func newTestOwnerScopedStore(t *testing.T, kind string, stored ...string) (*ownerScopedStore, *[]string) {
	t.Helper()
	group, resource := "preferences.grafana.app", "preferences"
	if kind == "stars" {
		group, resource = "collections.grafana.app", "stars"
	}
	owned, _ := hardcodedKindAuth(group, resource)
	require.NotNil(t, owned)

	has := map[string]bool{}
	for _, name := range stored {
		has[name] = true
	}
	var read []string
	store := &ownerScopedStore{
		owned: owned,
		stored: func(_ context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
			read = append(read, name)
			if !has[name] {
				return nil, apierrors.NewNotFound(schema.GroupResource{Group: group, Resource: resource}, name)
			}
			return objectNamed(name), nil
		},
		newList: func() runtime.Object { return &unstructured.UnstructuredList{} },
	}
	return store, &read
}

func ctxFor(r *identity.StaticRequester) context.Context {
	return identity.WithRequester(context.Background(), r)
}

func TestOwnerScopedStoreList(t *testing.T) {
	user := &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "abc", Groups: []string{"t1"}}

	list := func(t *testing.T, store *ownerScopedStore, ctx context.Context) []string {
		t.Helper()
		got, err := store.List(ctx, &metainternalversion.ListOptions{})
		require.NoError(t, err)
		items, err := meta.ExtractList(got)
		require.NoError(t, err)
		return namesOf(t, items)
	}

	t.Run("a user lists only what they own, most specific first", func(t *testing.T) {
		store, read := newTestOwnerScopedStore(t, "preferences", "user-abc", "user-other", "team-t1", "namespace")
		require.Equal(t, []string{"user-abc", "team-t1", "namespace"}, list(t, store, ctxFor(user)))
		require.NotContains(t, *read, "user-other")
	})

	t.Run("an owner without an object is left out", func(t *testing.T) {
		store, _ := newTestOwnerScopedStore(t, "preferences", "namespace")
		require.Equal(t, []string{"namespace"}, list(t, store, ctxFor(user)))
	})

	t.Run("a user's stars are only theirs", func(t *testing.T) {
		store, _ := newTestOwnerScopedStore(t, "stars", "user-abc", "user-other")
		require.Equal(t, []string{"user-abc"}, list(t, store, ctxFor(user)))
	})

	t.Run("anonymous lists only what every other identity does", func(t *testing.T) {
		anon := &identity.StaticRequester{Type: authlib.TypeAnonymous}

		store, read := newTestOwnerScopedStore(t, "preferences", "user-abc", "namespace")
		require.Equal(t, []string{"namespace"}, list(t, store, ctxFor(anon)))
		require.Equal(t, []string{"namespace"}, *read)

		store, read = newTestOwnerScopedStore(t, "stars", "user-abc")
		require.Empty(t, list(t, store, ctxFor(anon)), "stars have nothing for everyone")
		require.Empty(t, *read)
	})

	t.Run("another identity lists only the namespace's preferences", func(t *testing.T) {
		store, _ := newTestOwnerScopedStore(t, "preferences", "user-abc", "namespace")
		policy := &identity.StaticRequester{Type: authlib.TypeAccessPolicy, UserUID: "svc"}
		require.Equal(t, []string{"namespace"}, list(t, store, ctxFor(policy)))
	})

	t.Run("a user's list takes no continue token or label selector", func(t *testing.T) {
		store, _ := newTestOwnerScopedStore(t, "preferences")
		_, err := store.List(ctxFor(user), &metainternalversion.ListOptions{Continue: "x"})
		require.True(t, apierrors.IsBadRequest(err))
	})

	t.Run("a list without a requester fails", func(t *testing.T) {
		store, _ := newTestOwnerScopedStore(t, "preferences")
		_, err := store.List(context.Background(), nil)
		require.Error(t, err)
	})
}

func TestOwnerScopedStoreWatch(t *testing.T) {
	user := &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "abc", Groups: []string{"t1"}}
	store, _ := newTestOwnerScopedStore(t, "preferences")
	_, err := store.Watch(ctxFor(user), &metainternalversion.ListOptions{})
	require.True(t, apierrors.IsForbidden(err), "a user may not watch")
}

func TestWithStoredResourceVersion(t *testing.T) {
	withRV := func(rv string) *unstructured.Unstructured {
		u := objectNamed("user-abc")
		u.SetResourceVersion(rv)
		return u
	}
	update := func(t *testing.T, requested *unstructured.Unstructured, current *unstructured.Unstructured) string {
		t.Helper()
		got, err := withStoredResourceVersion{rest.DefaultUpdatedObjectInfo(requested)}.UpdatedObject(context.Background(), current)
		require.NoError(t, err)
		return got.(*unstructured.Unstructured).GetResourceVersion()
	}

	t.Run("an update without a resource version is made against the stored one", func(t *testing.T) {
		require.Equal(t, "7", update(t, withRV(""), withRV("7")))
		require.Equal(t, "7", update(t, withRV("0"), withRV("7")))
	})

	t.Run("an update that names one keeps it", func(t *testing.T) {
		require.Equal(t, "5", update(t, withRV("5"), withRV("7")), "a stale version still conflicts")
	})

	t.Run("the update's own failure is returned", func(t *testing.T) {
		boom := errors.New("boom")
		_, err := withStoredResourceVersion{failingUpdate{boom}}.UpdatedObject(context.Background(), withRV("7"))
		require.ErrorIs(t, err, boom)
	})
}

type failingUpdate struct{ err error }

func (failingUpdate) Preconditions() *metav1.Preconditions { return nil }

func (f failingUpdate) UpdatedObject(context.Context, runtime.Object) (runtime.Object, error) {
	return nil, f.err
}
