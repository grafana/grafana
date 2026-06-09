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

	claims "github.com/grafana/authlib/types"
	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
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

	t.Run("non-user identity is rejected", func(t *testing.T) {
		store := &preferencesStorage{Storage: &fakeStorage{}}
		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Type:    claims.TypeServiceAccount,
			UserUID: "sa-1",
		})
		_, err := store.ListPreferences(ctx, nil)
		require.ErrorContains(t, err, "only users may list preferences")
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

// fakeStorage is a minimal grafanarest.Storage implementation that only
// supports Get; ListPreferences only ever calls Get on the wrapped store.
type fakeStorage struct {
	grafanarest.Storage
	items map[string]*preferences.Preferences
	calls []string
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
