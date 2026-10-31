package pluginroute

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	authlib "github.com/grafana/authlib/types"
	prefsv1 "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/setting"
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

func newTestOwnedStore(t *testing.T, kind string, stored ...string) (*ownedStore, *[]string) {
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
	store := &ownedStore{
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

func TestOwnedListStoreList(t *testing.T) {
	user := &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "abc", Groups: []string{"t1"}}

	list := func(t *testing.T, store *ownedStore, ctx context.Context) []string {
		t.Helper()
		got, err := store.List(ctx, &metainternalversion.ListOptions{})
		require.NoError(t, err)
		items, err := meta.ExtractList(got)
		require.NoError(t, err)
		return namesOf(t, items)
	}

	t.Run("a user lists only what they own, most specific first", func(t *testing.T) {
		store, read := newTestOwnedStore(t, "preferences", "user-abc", "user-other", "team-t1", "namespace")
		require.Equal(t, []string{"user-abc", "team-t1", "namespace"}, list(t, store, ctxFor(user)))
		require.NotContains(t, *read, "user-other")
	})

	t.Run("an owner without an object is left out", func(t *testing.T) {
		store, _ := newTestOwnedStore(t, "preferences", "namespace")
		require.Equal(t, []string{"namespace"}, list(t, store, ctxFor(user)))
	})

	t.Run("a user's stars are only theirs", func(t *testing.T) {
		store, _ := newTestOwnedStore(t, "stars", "user-abc", "user-other")
		require.Equal(t, []string{"user-abc"}, list(t, store, ctxFor(user)))
	})

	t.Run("anonymous lists only what every other identity does", func(t *testing.T) {
		anon := &identity.StaticRequester{Type: authlib.TypeAnonymous}

		store, read := newTestOwnedStore(t, "preferences", "user-abc", "namespace")
		require.Equal(t, []string{"namespace"}, list(t, store, ctxFor(anon)))
		require.Equal(t, []string{"namespace"}, *read)

		store, read = newTestOwnedStore(t, "stars", "user-abc")
		require.Empty(t, list(t, store, ctxFor(anon)), "stars have nothing for everyone")
		require.Empty(t, *read)
	})

	t.Run("another identity lists only the namespace's preferences", func(t *testing.T) {
		store, _ := newTestOwnedStore(t, "preferences", "user-abc", "namespace")
		policy := &identity.StaticRequester{Type: authlib.TypeAccessPolicy, UserUID: "svc"}
		require.Equal(t, []string{"namespace"}, list(t, store, ctxFor(policy)))
	})

	t.Run("a user's list takes no continue token or label selector", func(t *testing.T) {
		store, _ := newTestOwnedStore(t, "preferences")
		_, err := store.List(ctxFor(user), &metainternalversion.ListOptions{Continue: "x"})
		require.True(t, apierrors.IsBadRequest(err))
	})

	t.Run("a list without a requester fails", func(t *testing.T) {
		store, _ := newTestOwnedStore(t, "preferences")
		_, err := store.List(context.Background(), nil)
		require.Error(t, err)
	})
}

func TestOwnedListStoreVirtualGet(t *testing.T) {
	user := &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "abc", Groups: []string{"t1"}}

	t.Run("a virtual name is answered from the owned objects", func(t *testing.T) {
		store, _ := newTestOwnedStore(t, "preferences", "user-abc", "team-t1", "namespace", "user-other")
		var got []string
		store.virtual = func(_ context.Context, name string, owned []runtime.Object) (runtime.Object, error) {
			got = namesOf(t, owned)
			return objectNamed(fmt.Sprintf("answer-%s", name)), nil
		}
		obj, err := store.Get(ctxFor(user), "merged", &metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, "answer-merged", obj.(*unstructured.Unstructured).GetName())
		require.Equal(t, []string{"user-abc", "team-t1", "namespace"}, got)
	})

	t.Run("anonymous is answered from the namespace's object", func(t *testing.T) {
		store, _ := newTestOwnedStore(t, "preferences", "user-abc", "namespace")
		var got []string
		store.virtual = func(_ context.Context, _ string, owned []runtime.Object) (runtime.Object, error) {
			got = namesOf(t, owned)
			return objectNamed("merged"), nil
		}
		_, err := store.Get(ctxFor(&identity.StaticRequester{Type: authlib.TypeAnonymous}), "merged", &metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, []string{"namespace"}, got)
	})

	t.Run("any other name is a stored object", func(t *testing.T) {
		store, read := newTestOwnedStore(t, "preferences", "user-abc")
		store.virtual = func(context.Context, string, []runtime.Object) (runtime.Object, error) {
			t.Fatal("not a virtual name")
			return nil, nil
		}
		_, err := store.Get(ctxFor(user), "user-abc", &metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, []string{"user-abc"}, *read)
	})

	t.Run("without a getter a fixed name is stored", func(t *testing.T) {
		store, _ := newTestOwnedStore(t, "preferences")
		_, err := store.Get(ctxFor(user), "merged", &metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err))
	})

	t.Run("a user may not watch", func(t *testing.T) {
		store, _ := newTestOwnedStore(t, "preferences")
		_, err := store.Watch(ctxFor(user), &metainternalversion.ListOptions{})
		require.True(t, apierrors.IsForbidden(err))
	})
}

func TestHardcodedVirtualGetter(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.DefaultTheme = "light"

	require.Nil(t, hardcodedVirtualGetter("collections.grafana.app", "stars", cfg), "stars have no virtual names")
	require.Nil(t, hardcodedVirtualGetter("preferences.grafana.app", "preferences", nil), "without configuration there are no defaults to merge")

	get := hardcodedVirtualGetter("preferences.grafana.app", "preferences", cfg)
	require.NotNil(t, get)
	obj, err := get(t.Context(), "merged", nil)
	require.NoError(t, err)
	u, ok := obj.(*unstructured.Unstructured)
	require.True(t, ok)
	var prefs prefsv1.Preferences
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(u.Object, &prefs))
	require.Equal(t, "light", *prefs.Spec.Theme, "the configured defaults fill an empty merge")
}
