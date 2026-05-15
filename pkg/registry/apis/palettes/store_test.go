package palettes

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"

	authlib "github.com/grafana/authlib/types"
	palettesapi "github.com/grafana/grafana/apps/palettes/pkg/apis/palettes/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
)

func TestPaletteStorage_List(t *testing.T) {
	// Five mixed-owner palettes (Phase H-style fixture).
	fixture := &palettesapi.PaletteList{
		Items: []palettesapi.Palette{
			newPalette("org-corp", nil),
			newPalette("user-alice-private", nil),
			newPalette("user-carol-secret", nil),
			newPalette("team-frontend-warm", nil),
			newPalette("user-alice-sunset", []palettesapi.PalettePaletteVisibility{"org"}),
		},
	}

	alice := &identity.StaticRequester{
		Type:    authlib.TypeUser,
		UserUID: "alice",
		Groups:  []string{"frontend", "zeta"},
		OrgRole: identity.RoleViewer,
	}
	carol := &identity.StaticRequester{
		Type:    authlib.TypeUser,
		UserUID: "carol",
		Groups:  []string{"other"},
		OrgRole: identity.RoleViewer,
	}
	admin := &identity.StaticRequester{
		Type:    authlib.TypeUser,
		UserUID: "bob",
		OrgRole: identity.RoleAdmin,
	}

	t.Run("admin sees all items", func(t *testing.T) {
		m := grafanarest.NewMockStorage(t)
		m.On("List", mock.Anything, mock.Anything).Return(fixture.DeepCopy(), nil)
		store := &paletteStorage{Storage: m}
		ctx := identity.WithRequester(context.Background(), admin)
		obj, err := store.List(ctx, nil)
		require.NoError(t, err)
		list := obj.(*palettesapi.PaletteList)
		require.Len(t, list.Items, 5)
		require.Equal(t, paletteNames(fixture), paletteNames(list))
	})

	t.Run("user sees own org team and shareWith", func(t *testing.T) {
		m := grafanarest.NewMockStorage(t)
		m.On("List", mock.Anything, mock.Anything).Return(fixture.DeepCopy(), nil)
		store := &paletteStorage{Storage: m}
		ctx := identity.WithRequester(context.Background(), alice)
		obj, err := store.List(ctx, nil)
		require.NoError(t, err)
		list := obj.(*palettesapi.PaletteList)
		require.ElementsMatch(t, []string{
			"org-corp",
			"user-alice-private",
			"team-frontend-warm",
			"user-alice-sunset",
		}, paletteNames(list))
	})

	t.Run("user does not see other users private palettes", func(t *testing.T) {
		m := grafanarest.NewMockStorage(t)
		m.On("List", mock.Anything, mock.Anything).Return(fixture.DeepCopy(), nil)
		store := &paletteStorage{Storage: m}
		ctx := identity.WithRequester(context.Background(), carol)
		obj, err := store.List(ctx, nil)
		require.NoError(t, err)
		list := obj.(*palettesapi.PaletteList)
		require.ElementsMatch(t, []string{
			"org-corp",
			"user-carol-secret",
			"user-alice-sunset",
		}, paletteNames(list))
	})

	t.Run("continue token is rejected", func(t *testing.T) {
		m := grafanarest.NewMockStorage(t)
		store := &paletteStorage{Storage: m}
		ctx := identity.WithRequester(context.Background(), alice)
		_, err := store.List(ctx, &internalversion.ListOptions{Continue: "token"})
		require.ErrorContains(t, err, "continue token not supported")
		m.AssertNotCalled(t, "List")
	})

	t.Run("non-user identity is rejected", func(t *testing.T) {
		m := grafanarest.NewMockStorage(t)
		store := &paletteStorage{Storage: m}
		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Type:    authlib.TypeServiceAccount,
			UserUID: "sa-1",
		})
		_, err := store.List(ctx, nil)
		require.ErrorContains(t, err, "only users may list palettes")
		m.AssertNotCalled(t, "List")
	})

	t.Run("missing requester", func(t *testing.T) {
		m := grafanarest.NewMockStorage(t)
		store := &paletteStorage{Storage: m}
		_, err := store.List(context.Background(), nil)
		require.Error(t, err)
		m.AssertNotCalled(t, "List")
	})

	t.Run("user without identifier is rejected", func(t *testing.T) {
		m := grafanarest.NewMockStorage(t)
		store := &paletteStorage{Storage: m}
		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Type: authlib.TypeUser,
		})
		_, err := store.List(ctx, nil)
		require.ErrorContains(t, err, "user identifier is required")
		m.AssertNotCalled(t, "List")
	})

	t.Run("wrong list type from inner storage", func(t *testing.T) {
		m := grafanarest.NewMockStorage(t)
		m.On("List", mock.Anything, mock.Anything).Return(&metav1.PartialObjectMetadataList{}, nil)
		store := &paletteStorage{Storage: m}
		ctx := identity.WithRequester(context.Background(), alice)
		_, err := store.List(ctx, nil)
		require.ErrorContains(t, err, "expected PaletteList")
	})

	t.Run("non-empty label selector is rejected", func(t *testing.T) {
		m := grafanarest.NewMockStorage(t)
		store := &paletteStorage{Storage: m}
		ctx := identity.WithRequester(context.Background(), alice)
		sel, err := labels.Parse("app=test")
		require.NoError(t, err)
		_, err = store.List(ctx, &internalversion.ListOptions{LabelSelector: sel})
		require.ErrorContains(t, err, "labelSelector not supported")
		m.AssertNotCalled(t, "List")
	})

	t.Run("caps teams when evaluating shareWith", func(t *testing.T) {
		groups := make([]string, 0, PalettesTeamLimit+2)
		for i := range PalettesTeamLimit + 2 {
			groups = append(groups, fmt.Sprintf("t-%02d", i))
		}
		// t-00..t-24 are the first PalettesTeamLimit teams after sort; t-25 and t-26 are dropped.
		list := &palettesapi.PaletteList{
			Items: []palettesapi.Palette{
				newPalette("user-stranger-x", []palettesapi.PalettePaletteVisibility{"team-t-26"}),
			},
		}
		user := &identity.StaticRequester{
			Type:    authlib.TypeUser,
			UserUID: "u1",
			Groups:  groups,
			OrgRole: identity.RoleViewer,
		}
		m := grafanarest.NewMockStorage(t)
		m.On("List", mock.Anything, mock.Anything).Return(list.DeepCopy(), nil)
		store := &paletteStorage{Storage: m}
		ctx := identity.WithRequester(context.Background(), user)
		obj, err := store.List(ctx, nil)
		require.NoError(t, err)
		out := obj.(*palettesapi.PaletteList)
		require.Empty(t, out.Items, "team-t-26 must be ignored when beyond PalettesTeamLimit")
	})
}

func newPalette(name string, share []palettesapi.PalettePaletteVisibility) palettesapi.Palette {
	return palettesapi.Palette{
		ObjectMeta: metav1.ObjectMeta{Name: name},
		Spec: palettesapi.PaletteSpec{
			ShareWith: share,
		},
	}
}

func paletteNames(list *palettesapi.PaletteList) []string {
	out := make([]string, 0, len(list.Items))
	for i := range list.Items {
		out = append(out, list.Items[i].Name)
	}
	return out
}
