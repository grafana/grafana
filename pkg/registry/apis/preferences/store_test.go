package preferences

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	requestK8s "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/utils/ptr"

	claims "github.com/grafana/authlib/types"
	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
)

func TestListPreferences(t *testing.T) {
	userABC := &identity.StaticRequester{
		Type:    claims.TypeUser,
		UserUID: "abc",
		Groups:  []string{"x", "a", "b"}, // intentionally unsorted
	}

	allItems := map[string]*preferences.Preferences{
		"user-abc":  newPref("user-abc"),
		"user-zzz":  newPref("user-zzz"),
		"team-a":    newPref("team-a"),
		"team-b":    newPref("team-b"),
		"team-x":    newPref("team-x"),
		"team-zzz":  newPref("team-zzz"), // user is not a member
		"namespace": newPref("namespace"),
	}

	t.Run("returns user, team (sorted), then namespace prefs in inheritance order", func(t *testing.T) {
		fake := &fakeStorage{items: allItems}
		store := &preferencesStorage{Storage: fake}

		ctx := identity.WithRequester(context.Background(), userABC)
		list, err := store.ListPreferences(ctx, nil)
		require.NoError(t, err)

		// Teams must be sorted alphabetically (per slices.Sort in store.go)
		require.Equal(t, []string{
			"user-abc",
			"team-a",
			"team-b",
			"team-x",
			"namespace",
		}, names(list))
	})

	t.Run("items without preferences silently skipped", func(t *testing.T) {
		fake := &fakeStorage{items: map[string]*preferences.Preferences{
			// no user-abc, no team-a, no team-x → those Gets return NotFound and are skipped
			"team-b":    newPref("team-b"),
			"namespace": newPref("namespace"),
		}}
		store := &preferencesStorage{Storage: fake}

		ctx := identity.WithRequester(context.Background(), userABC)
		list, err := store.ListPreferences(ctx, nil)
		require.NoError(t, err)
		require.Equal(t, []string{"team-b", "namespace"}, names(list))
	})

	t.Run("returns empty list when nothing is stored", func(t *testing.T) {
		fake := &fakeStorage{items: map[string]*preferences.Preferences{}}
		store := &preferencesStorage{Storage: fake}

		ctx := identity.WithRequester(context.Background(), userABC)
		list, err := store.ListPreferences(ctx, nil)
		require.NoError(t, err)
		require.Empty(t, list.Items)
	})

	t.Run("caps team lookups at 25 (the first 25 sorted groups)", func(t *testing.T) {
		groups := make([]string, 0, 30)
		teamItems := map[string]*preferences.Preferences{
			"user-abc":  newPref("user-abc"),
			"namespace": newPref("namespace"),
		}
		for i := range 30 {
			id := fmt.Sprintf("g-%02d", i)
			groups = append(groups, id)
			teamItems["team-"+id] = newPref("team-" + id)
		}
		user := &identity.StaticRequester{
			Type:    claims.TypeUser,
			UserUID: "abc",
			Groups:  groups,
		}
		fake := &fakeStorage{items: teamItems}
		store := &preferencesStorage{Storage: fake}

		ctx := identity.WithRequester(context.Background(), user)
		list, err := store.ListPreferences(ctx, nil)
		require.NoError(t, err)

		// 1 user + first 25 sorted teams + 1 namespace
		require.Len(t, list.Items, 1+25+1)
		require.Equal(t, "user-abc", list.Items[0].Name)
		require.Equal(t, "team-g-00", list.Items[1].Name)
		require.Equal(t, "team-g-24", list.Items[25].Name)
		require.Equal(t, "namespace", list.Items[26].Name)
	})

	t.Run("nil options is treated as empty options", func(t *testing.T) {
		fake := &fakeStorage{items: map[string]*preferences.Preferences{
			"user-abc": newPref("user-abc"),
		}}
		store := &preferencesStorage{Storage: fake}

		ctx := identity.WithRequester(context.Background(), userABC)
		list, err := store.ListPreferences(ctx, nil)
		require.NoError(t, err)
		require.Equal(t, []string{"user-abc"}, names(list))
	})

	t.Run("List delegates to ListPreferences", func(t *testing.T) {
		fake := &fakeStorage{items: map[string]*preferences.Preferences{
			"namespace": newPref("namespace"),
		}}
		store := &preferencesStorage{Storage: fake}

		ctx := identity.WithRequester(context.Background(), userABC)
		obj, err := store.List(ctx, nil)
		require.NoError(t, err)
		list, ok := obj.(*preferences.PreferencesList)
		require.True(t, ok)
		require.Equal(t, []string{"namespace"}, names(list))
	})
}

func TestListPreferences_FieldSelector(t *testing.T) {
	userABC := &identity.StaticRequester{
		Type:    claims.TypeUser,
		UserUID: "abc",
		Groups:  []string{"x"},
	}

	items := map[string]*preferences.Preferences{
		"user-abc":  newPref("user-abc"),
		"user-zzz":  newPref("user-zzz"),
		"team-x":    newPref("team-x"),
		"team-zzz":  newPref("team-zzz"),
		"namespace": newPref("namespace"),
	}

	cases := []struct {
		name     string
		selector fields.Selector
		expect   []string
	}{
		{
			name:     "selects own user pref",
			selector: fields.OneTermEqualSelector("metadata.name", "user-abc"),
			expect:   []string{"user-abc"},
		},
		{
			name:     "filters out other user's pref",
			selector: fields.OneTermEqualSelector("metadata.name", "user-zzz"),
			expect:   []string{},
		},
		{
			name:     "selects team the user belongs to",
			selector: fields.OneTermEqualSelector("metadata.name", "team-x"),
			expect:   []string{"team-x"},
		},
		{
			name:     "filters out team the user does not belong to",
			selector: fields.OneTermEqualSelector("metadata.name", "team-zzz"),
			expect:   []string{},
		},
		{
			name:     "selects the namespace pref",
			selector: fields.OneTermEqualSelector("metadata.name", "namespace"),
			expect:   []string{"namespace"},
		},
		{
			name:     "skips unknown owner names",
			selector: fields.OneTermEqualSelector("metadata.name", "bogus"),
			expect:   []string{},
		},
		{
			name:     "missing item is silently dropped",
			selector: fields.OneTermEqualSelector("metadata.name", "user-does-not-exist"),
			expect:   []string{},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			fake := &fakeStorage{items: items}
			store := &preferencesStorage{Storage: fake}

			ctx := identity.WithRequester(context.Background(), userABC)
			list, err := store.ListPreferences(ctx, &internalversion.ListOptions{
				FieldSelector: tc.selector,
			})
			require.NoError(t, err)
			require.Equal(t, tc.expect, names(list))
		})
	}
}

func TestListPreferences_Errors(t *testing.T) {
	userABC := &identity.StaticRequester{
		Type:    claims.TypeUser,
		UserUID: "abc",
	}

	t.Run("missing requester", func(t *testing.T) {
		store := &preferencesStorage{Storage: &fakeStorage{}}
		_, err := store.ListPreferences(context.Background(), nil)
		require.Error(t, err)
	})

	t.Run("non-user identity only receives namespace preferences", func(t *testing.T) {
		fake := &fakeStorage{items: map[string]*preferences.Preferences{
			"user-sa-1": newPref("user-sa-1"),
			"team-a":    newPref("team-a"),
			"namespace": newPref("namespace"),
		}}
		store := &preferencesStorage{Storage: fake}
		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Type:    claims.TypeServiceAccount,
			UserUID: "sa-1",
			Groups:  []string{"a"},
		})
		list, err := store.ListPreferences(ctx, nil)
		require.NoError(t, err)
		require.Equal(t, []string{"namespace"}, names(list))
	})

	t.Run("user without identifier is rejected", func(t *testing.T) {
		store := &preferencesStorage{Storage: &fakeStorage{}}
		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Type: claims.TypeUser,
		})
		_, err := store.ListPreferences(ctx, nil)
		require.ErrorContains(t, err, "user identifier is required")
	})

	t.Run("continue token is not supported", func(t *testing.T) {
		store := &preferencesStorage{Storage: &fakeStorage{}}
		ctx := identity.WithRequester(context.Background(), userABC)
		_, err := store.ListPreferences(ctx, &internalversion.ListOptions{Continue: "abc"})
		require.ErrorContains(t, err, "continue token not supported")
	})

	t.Run("non-empty label selector is rejected", func(t *testing.T) {
		store := &preferencesStorage{Storage: &fakeStorage{}}
		ctx := identity.WithRequester(context.Background(), userABC)
		sel, err := labels.Parse("foo=bar")
		require.NoError(t, err)
		_, err = store.ListPreferences(ctx, &internalversion.ListOptions{LabelSelector: sel})
		require.ErrorContains(t, err, "labelSelector not supported")
	})

	t.Run("empty label selector is allowed", func(t *testing.T) {
		fake := &fakeStorage{items: map[string]*preferences.Preferences{}}
		store := &preferencesStorage{Storage: fake}
		ctx := identity.WithRequester(context.Background(), userABC)
		_, err := store.ListPreferences(ctx, &internalversion.ListOptions{LabelSelector: labels.Everything()})
		require.NoError(t, err)
	})

	t.Run("multi-term field selector is rejected", func(t *testing.T) {
		store := &preferencesStorage{Storage: &fakeStorage{}}
		ctx := identity.WithRequester(context.Background(), userABC)
		sel, err := fields.ParseSelector("metadata.name=user-abc,metadata.namespace=default")
		require.NoError(t, err)
		_, err = store.ListPreferences(ctx, &internalversion.ListOptions{FieldSelector: sel})
		require.ErrorContains(t, err, "only one fieldSelector is supported")
	})

	t.Run("non metadata.name field selector is rejected", func(t *testing.T) {
		store := &preferencesStorage{Storage: &fakeStorage{}}
		ctx := identity.WithRequester(context.Background(), userABC)
		_, err := store.ListPreferences(ctx, &internalversion.ListOptions{
			FieldSelector: fields.OneTermEqualSelector("metadata.namespace", "default"),
		})
		require.ErrorContains(t, err, "only the metadata.name fieldSelector is supported")
	})

	t.Run("non-equals operator is rejected", func(t *testing.T) {
		store := &preferencesStorage{Storage: &fakeStorage{}}
		ctx := identity.WithRequester(context.Background(), userABC)
		_, err := store.ListPreferences(ctx, &internalversion.ListOptions{
			FieldSelector: fields.OneTermNotEqualSelector("metadata.name", "user-abc"),
		})
		require.ErrorContains(t, err, "only the = operator is supported")
	})

	t.Run("unexpected runtime type from Get bubbles up", func(t *testing.T) {
		fake := &errorStorage{}
		store := &preferencesStorage{Storage: fake}
		ctx := identity.WithRequester(context.Background(), userABC)
		_, err := store.ListPreferences(ctx, nil)
		require.ErrorContains(t, err, "expected preferences")
	})
}

func TestPreferencesStorage_Update(t *testing.T) {
	ctx := requestK8s.WithNamespace(context.Background(), "default")

	// setTheme mimics the apiserver's merge-patch transformer: it requires
	// the current object to carry a UID (the real transformer returns 404
	// otherwise) and applies a single-field change on top of it.
	setTheme := func(theme string) rest.UpdatedObjectInfo {
		return rest.DefaultUpdatedObjectInfo(nil, func(_ context.Context, _, oldObj runtime.Object) (runtime.Object, error) {
			old, ok := oldObj.(*preferences.Preferences)
			if !ok {
				return nil, fmt.Errorf("expected preferences, got %T", oldObj)
			}
			if old.UID == "" {
				return nil, k8serrors.NewNotFound(
					schema.GroupResource{Group: preferences.APIGroup, Resource: "preferences"},
					old.Name,
				)
			}
			patched := old.DeepCopy()
			patched.Spec.Theme = ptr.To(theme)
			return patched, nil
		})
	}

	newStore := func(fake *fakeStorage) *preferencesStorage {
		return &preferencesStorage{Storage: fake, gvk: preferences.PreferencesResourceInfo.GroupVersionKind()}
	}

	t.Run("creates preferences that do not exist yet", func(t *testing.T) {
		fake := &fakeStorage{items: map[string]*preferences.Preferences{}}
		store := newStore(fake)

		obj, created, err := store.Update(ctx, "user-abc", setTheme("dark"), nil, nil, false, &metav1.UpdateOptions{})
		require.NoError(t, err)
		require.True(t, created)

		p, ok := obj.(*preferences.Preferences)
		require.True(t, ok)
		require.Equal(t, "user-abc", p.Name)
		require.Equal(t, "default", p.Namespace)
		require.Equal(t, ptr.To("dark"), p.Spec.Theme)

		require.Equal(t, []string{"user-abc"}, fake.created)
		require.Empty(t, fake.updated)
	})

	t.Run("updates preferences that already exist", func(t *testing.T) {
		existing := newPref("user-abc")
		existing.UID = "existing-uid"
		existing.Spec.Theme = ptr.To("light")
		fake := &fakeStorage{items: map[string]*preferences.Preferences{"user-abc": existing}}
		store := newStore(fake)

		obj, created, err := store.Update(ctx, "user-abc", setTheme("dark"), nil, nil, false, &metav1.UpdateOptions{})
		require.NoError(t, err)
		require.False(t, created)

		p, ok := obj.(*preferences.Preferences)
		require.True(t, ok)
		require.Equal(t, ptr.To("dark"), p.Spec.Theme)

		require.Empty(t, fake.created)
		require.Equal(t, []string{"user-abc"}, fake.updated)
	})

	t.Run("falls back to update when losing a create race", func(t *testing.T) {
		// The first Update reports NotFound but Create collides with
		// AlreadyExists, as if another request created the preferences in
		// between; the retried Update must then succeed
		existing := newPref("user-abc")
		existing.UID = "existing-uid"
		fake := &fakeStorage{
			items: map[string]*preferences.Preferences{"user-abc": existing},
			createErr: k8serrors.NewAlreadyExists(
				schema.GroupResource{Group: preferences.APIGroup, Resource: "preferences"},
				"user-abc",
			),
		}
		store := &preferencesStorage{
			Storage: &failFirstUpdateStorage{fakeStorage: fake},
			gvk:     preferences.PreferencesResourceInfo.GroupVersionKind(),
		}

		obj, created, err := store.Update(ctx, "user-abc", setTheme("dark"), nil, nil, false, &metav1.UpdateOptions{})
		require.NoError(t, err)
		require.False(t, created)

		p, ok := obj.(*preferences.Preferences)
		require.True(t, ok)
		require.Equal(t, ptr.To("dark"), p.Spec.Theme)
		require.Equal(t, []string{"user-abc"}, fake.updated)
	})

	t.Run("non-NotFound errors from Update bubble up", func(t *testing.T) {
		fake := &forbiddenStorage{}
		store := &preferencesStorage{Storage: fake, gvk: preferences.PreferencesResourceInfo.GroupVersionKind()}

		_, _, err := store.Update(ctx, "user-abc", setTheme("dark"), nil, nil, false, &metav1.UpdateOptions{})
		require.Error(t, err)
		require.True(t, k8serrors.IsForbidden(err))
	})
}

// fakeStorage is a minimal grafanarest.Storage implementation supporting
// Get, Create and Update -- everything the preferencesStorage wrapper calls
// on the wrapped store.
type fakeStorage struct {
	grafanarest.Storage
	items     map[string]*preferences.Preferences
	calls     []string
	created   []string
	updated   []string
	createErr error
}

func (f *fakeStorage) Get(_ context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	f.calls = append(f.calls, name)
	if obj, ok := f.items[name]; ok {
		return obj, nil
	}
	return nil, k8serrors.NewNotFound(
		schema.GroupResource{Group: preferences.APIGroup, Resource: "preferences"},
		name,
	)
}

func (f *fakeStorage) New() runtime.Object {
	return &preferences.Preferences{}
}

func (f *fakeStorage) Create(_ context.Context, obj runtime.Object, _ rest.ValidateObjectFunc, _ *metav1.CreateOptions) (runtime.Object, error) {
	if f.createErr != nil {
		return nil, f.createErr
	}
	p, ok := obj.(*preferences.Preferences)
	if !ok {
		return nil, fmt.Errorf("expected preferences, got %T", obj)
	}
	if _, exists := f.items[p.Name]; exists {
		return nil, k8serrors.NewAlreadyExists(
			schema.GroupResource{Group: preferences.APIGroup, Resource: "preferences"},
			p.Name,
		)
	}
	f.created = append(f.created, p.Name)
	f.items[p.Name] = p
	return p, nil
}

func (f *fakeStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, _ rest.ValidateObjectFunc, _ rest.ValidateObjectUpdateFunc, _ bool, _ *metav1.UpdateOptions) (runtime.Object, bool, error) {
	old, exists := f.items[name]
	if !exists {
		return nil, false, k8serrors.NewNotFound(
			schema.GroupResource{Group: preferences.APIGroup, Resource: "preferences"},
			name,
		)
	}
	obj, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return nil, false, err
	}
	p, ok := obj.(*preferences.Preferences)
	if !ok {
		return nil, false, fmt.Errorf("expected preferences, got %T", obj)
	}
	f.updated = append(f.updated, name)
	f.items[name] = p
	return p, false, nil
}

func newPref(name string) *preferences.Preferences {
	return &preferences.Preferences{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "default"},
	}
}

func names(list *preferences.PreferencesList) []string {
	out := make([]string, 0, len(list.Items))
	for _, item := range list.Items {
		out = append(out, item.Name)
	}
	return out
}

// errorStorage returns a non-Preferences runtime.Object from Get, exercising
// the "unexpected type" guard inside addPreferencesToResult.
type errorStorage struct {
	grafanarest.Storage
}

func (e *errorStorage) Get(_ context.Context, _ string, _ *metav1.GetOptions) (runtime.Object, error) {
	return &preferences.PreferencesList{}, nil
}

// failFirstUpdateStorage fails the first Update with NotFound but otherwise
// behaves like the wrapped fakeStorage, simulating a concurrent create
// between the failed optimistic update and the upsert's Create call.
type failFirstUpdateStorage struct {
	*fakeStorage
	failed bool
}

func (n *failFirstUpdateStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	if !n.failed {
		n.failed = true
		return nil, false, k8serrors.NewNotFound(
			schema.GroupResource{Group: preferences.APIGroup, Resource: "preferences"},
			name,
		)
	}
	return n.fakeStorage.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
}

// forbiddenStorage fails Update with a non-NotFound error to verify such
// errors are not treated as "missing, create it".
type forbiddenStorage struct {
	grafanarest.Storage
}

func (f *forbiddenStorage) Update(_ context.Context, name string, _ rest.UpdatedObjectInfo, _ rest.ValidateObjectFunc, _ rest.ValidateObjectUpdateFunc, _ bool, _ *metav1.UpdateOptions) (runtime.Object, bool, error) {
	return nil, false, k8serrors.NewForbidden(
		schema.GroupResource{Group: preferences.APIGroup, Resource: "preferences"},
		name,
		fmt.Errorf("nope"),
	)
}
