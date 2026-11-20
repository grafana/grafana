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
	"k8s.io/apimachinery/pkg/fields"
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
	owned := namespaceUserTeamOwner()
	if kind == "stars" {
		owned = ownerFor(t, "collections.grafana.app", "stars")
		require.NotNil(t, owned)
	}

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
				return nil, apierrors.NewNotFound(schema.GroupResource{Group: "test.grafana.app", Resource: "owned"}, name)
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

	t.Run("a name selector returns only that object, if the caller may get it", func(t *testing.T) {
		byName := func(name string) *metainternalversion.ListOptions {
			return &metainternalversion.ListOptions{FieldSelector: fields.OneTermEqualSelector("metadata.name", name)}
		}
		names := func(store *ownerScopedStore, name string) []string {
			got, err := store.List(ctxFor(user), byName(name))
			require.NoError(t, err)
			items, err := meta.ExtractList(got)
			require.NoError(t, err)
			return namesOf(t, items)
		}
		store, _ := newTestOwnerScopedStore(t, "preferences", "user-abc", "user-other", "team-t1", "team-t2", "namespace")
		require.Equal(t, []string{"namespace"}, names(store, "namespace"))
		require.Equal(t, []string{"team-t1"}, names(store, "team-t1"))
		require.Empty(t, names(store, "user-other"), "another user's object")
		require.Empty(t, names(store, "team-t2"), "a team the caller is not in, without access to it")
		require.Empty(t, names(store, "team-none"), "an object that does not exist")

		parsed, err := fields.ParseSelector("metadata.name==team-t1")
		require.NoError(t, err)
		got, err := store.List(ctxFor(user), &metainternalversion.ListOptions{FieldSelector: parsed})
		require.NoError(t, err, "== is the same selector as =")
		items, err := meta.ExtractList(got)
		require.NoError(t, err)
		require.Equal(t, []string{"team-t1"}, namesOf(t, items))

		other, err := fields.ParseSelector("spec.foo=bar")
		require.NoError(t, err)
		_, err = store.List(ctxFor(user), &metainternalversion.ListOptions{FieldSelector: other})
		require.True(t, apierrors.IsBadRequest(err))
	})

	t.Run("a list without a requester fails", func(t *testing.T) {
		store, _ := newTestOwnerScopedStore(t, "preferences")
		_, err := store.List(context.Background(), nil)
		require.Error(t, err)
	})
}

func TestOwnedListStoreWatch(t *testing.T) {
	user := &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "abc", Groups: []string{"t1"}}

	t.Run("a user may not watch", func(t *testing.T) {
		store, _ := newTestOwnerScopedStore(t, "preferences")
		_, err := store.Watch(ctxFor(user), &metainternalversion.ListOptions{})
		require.True(t, apierrors.IsForbidden(err))
	})
}

func TestWithStoredResourceVersion(t *testing.T) {
	withRV := func(rv string) *unstructured.Unstructured {
		u := objectNamed("user-abc")
		u.SetResourceVersion(rv)
		return u
	}
	update := func(t *testing.T, requested *unstructured.Unstructured, current *unstructured.Unstructured) string {
		t.Helper()
		got, err := withStoredResourceVersion{UpdatedObjectInfo: rest.DefaultUpdatedObjectInfo(requested)}.UpdatedObject(context.Background(), current)
		require.NoError(t, err)
		return got.(*unstructured.Unstructured).GetResourceVersion()
	}

	t.Run("an update without a resource version is made against the stored one", func(t *testing.T) {
		require.Equal(t, "7", update(t, withRV(""), withRV("7")))
	})

	t.Run("version 0 asks for a create, so it conflicts with a stored object", func(t *testing.T) {
		_, err := withStoredResourceVersion{UpdatedObjectInfo: rest.DefaultUpdatedObjectInfo(withRV("0"))}.UpdatedObject(context.Background(), withRV("7"))
		require.True(t, apierrors.IsConflict(err))

		got, err := withStoredResourceVersion{UpdatedObjectInfo: rest.DefaultUpdatedObjectInfo(withRV("0"))}.UpdatedObject(context.Background(), withRV(""))
		require.NoError(t, err)
		require.Equal(t, "", got.(*unstructured.Unstructured).GetResourceVersion())
	})

	t.Run("an update that names one keeps it", func(t *testing.T) {
		require.Equal(t, "5", update(t, withRV("5"), withRV("7")), "a stale version still conflicts")
	})

	t.Run("the update's own failure is returned", func(t *testing.T) {
		boom := errors.New("boom")
		_, err := withStoredResourceVersion{UpdatedObjectInfo: failingUpdate{boom}}.UpdatedObject(context.Background(), withRV("7"))
		require.ErrorIs(t, err, boom)
	})
}

type failingUpdate struct{ err error }

func (failingUpdate) Preconditions() *metav1.Preconditions { return nil }

func (f failingUpdate) UpdatedObject(context.Context, runtime.Object) (runtime.Object, error) {
	return nil, f.err
}

func TestOwnerScopedStoreCreate(t *testing.T) {
	user := &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "abc", OrgRole: identity.RoleEditor}

	newStore := func(owned *ownerFromName) (*ownerScopedStore, *[]string) {
		var created []string
		return &ownerScopedStore{
			owned:    owned,
			resource: schema.GroupResource{Group: "test.grafana.app", Resource: "owned"},
			create: func(_ context.Context, obj runtime.Object, _ rest.ValidateObjectFunc, _ *metav1.CreateOptions) (runtime.Object, error) {
				m, err := meta.Accessor(obj)
				require.NoError(t, err)
				created = append(created, m.GetName())
				return obj, nil
			},
		}, &created
	}

	t.Run("the owner's name is created", func(t *testing.T) {
		store, created := newStore(namespaceUserTeamOwner())
		_, err := store.Create(ctxFor(user), objectNamed("user-abc"), nil, &metav1.CreateOptions{})
		require.NoError(t, err)
		require.Equal(t, []string{"user-abc"}, *created)
	})

	t.Run("another owner's name is invalid", func(t *testing.T) {
		store, created := newStore(namespaceUserTeamOwner())
		_, err := store.Create(ctxFor(user), objectNamed("user-other"), nil, &metav1.CreateOptions{})
		require.True(t, apierrors.IsInvalid(err), "want an invalid error, got %v", err)
		require.Empty(t, *created)
	})

	t.Run("a name without an owner is invalid", func(t *testing.T) {
		store, created := newStore(namespaceUserTeamOwner())
		_, err := store.Create(ctxFor(user), objectNamed("something"), nil, &metav1.CreateOptions{})
		require.True(t, apierrors.IsInvalid(err), "want an invalid error, got %v", err)
		require.Empty(t, *created)
	})

	t.Run("an access policy is left to its token's permissions", func(t *testing.T) {
		store, created := newStore(namespaceUserTeamOwner())
		_, err := store.Create(ctxFor(&identity.StaticRequester{Type: authlib.TypeAccessPolicy, UserUID: "svc"}), objectNamed("user-other"), nil, &metav1.CreateOptions{})
		require.NoError(t, err)
		require.Equal(t, []string{"user-other"}, *created)
	})

	t.Run("user storage names", func(t *testing.T) {
		store, created := newStore(hardcodedOwnerFromName("userstorage.grafana.app", "user-storage"))
		_, err := store.Create(ctxFor(user), objectNamed("svc:abc"), nil, &metav1.CreateOptions{})
		require.NoError(t, err)
		_, err = store.Create(ctxFor(user), objectNamed("svc:other"), nil, &metav1.CreateOptions{})
		require.True(t, apierrors.IsInvalid(err), "want an invalid error, got %v", err)
		_, err = store.Create(ctxFor(&identity.StaticRequester{Type: authlib.TypeUser, UserUID: "root", IsGrafanaAdmin: true}), objectNamed("svc:other"), nil, &metav1.CreateOptions{})
		require.NoError(t, err, "a server admin may create any user's object")
		require.Equal(t, []string{"svc:abc", "svc:other"}, *created)
	})
}

func TestOwnerScopedStoreGrafanaAdminListsAll(t *testing.T) {
	store := &ownerScopedStore{owned: hardcodedOwnerFromName("userstorage.grafana.app", "user-storage")}
	admin := &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "root", IsGrafanaAdmin: true}
	_, all, err := store.ownedObjects(ctxFor(admin))
	require.NoError(t, err)
	require.True(t, all)
}
