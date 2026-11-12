package app

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/apps/preferences/pkg/apis/manifestdata"
	v1 "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1"
)

func TestValidate(t *testing.T) {
	config := &Config{IsValidTheme: func(id string) bool { return slices.Contains([]string{"dark", "light", "system"}, id) }}
	validate := func(spec v1.PreferencesSpec) error {
		return config.validate(t.Context(), &app.AdmissionRequest{Object: &v1.Preferences{
			ObjectMeta: metav1.ObjectMeta{Name: "user-1", Namespace: "default"},
			Spec:       spec,
		}})
	}
	fields := func(t *testing.T, err error) (names []string, types []metav1.CauseType) {
		t.Helper()
		status, ok := err.(apierrors.APIStatus) //nolint:errorlint // the status error is the error itself
		require.True(t, ok, "%T", err)
		for _, cause := range status.Status().Details.Causes {
			names = append(names, cause.Field)
			types = append(types, cause.Type)
		}
		return names, types
	}

	for _, spec := range []v1.PreferencesSpec{
		{},
		{Theme: new("")},
		{Theme: new("dark")},
		{Timezone: new("utc")},
		{Timezone: new("browser")},
		{Timezone: new("")},
		{Timezone: new("America/New_York")},
		{Theme: new("system"), Timezone: new("Europe/London")},
	} {
		require.NoError(t, validate(spec))
	}

	t.Run("invalid theme", func(t *testing.T) {
		names, types := fields(t, validate(v1.PreferencesSpec{Theme: new("not-a-real-theme")}))
		require.Equal(t, []string{"spec.theme"}, names)
		require.Equal(t, []metav1.CauseType{metav1.CauseTypeFieldValueInvalid}, types)
	})

	t.Run("invalid timezone", func(t *testing.T) {
		names, _ := fields(t, validate(v1.PreferencesSpec{Timezone: new("Mars/Olympus_Mons")}))
		require.Equal(t, []string{"spec.timezone"}, names)
	})

	t.Run("homeURL is rejected, even when empty", func(t *testing.T) {
		for _, url := range []string{"https://example.com", ""} {
			names, types := fields(t, validate(v1.PreferencesSpec{HomeURL: &url}))
			require.Equal(t, []string{"spec.homeURL"}, names)
			require.Equal(t, []metav1.CauseType{metav1.CauseTypeForbidden}, types)
		}
	})

	t.Run("every invalid field is reported, in order", func(t *testing.T) {
		names, _ := fields(t, validate(v1.PreferencesSpec{HomeURL: new("x"), Timezone: new("Not/A_Zone"), Theme: new("bogus")}))
		require.Equal(t, []string{"spec.homeURL", "spec.timezone", "spec.theme"}, names)
	})

	t.Run("without a theme check any theme is accepted", func(t *testing.T) {
		require.NoError(t, (&Config{}).validate(t.Context(), &app.AdmissionRequest{Object: &v1.Preferences{Spec: v1.PreferencesSpec{Theme: new("bogus")}}}))
	})

	t.Run("another kind of object is a bad request", func(t *testing.T) {
		err := config.validate(t.Context(), &app.AdmissionRequest{Object: &resource.UntypedObject{}})
		require.True(t, apierrors.IsBadRequest(err))
	})
}

type fakeLister struct {
	items []v1.Preferences
	err   error
	ns    string
}

func (f *fakeLister) ListAll(_ context.Context, namespace string, _ resource.ListOptions) (*v1.PreferencesList, error) {
	f.ns = namespace
	return &v1.PreferencesList{Items: f.items}, f.err
}

func callMerged(t *testing.T, route *mergedRoute) (int, []byte) {
	t.Helper()
	req := &app.CustomRouteRequest{Method: http.MethodGet}
	req.ResourceIdentifier.Namespace = "default"
	w := httptest.NewRecorder()
	require.NoError(t, route.get(t.Context(), w, req))
	return w.Code, w.Body.Bytes()
}

func TestMergedRoute(t *testing.T) {
	config := &Config{Defaults: v1.PreferencesSpec{Theme: new("settings.ini"), Language: new("settings.ini")}}

	t.Run("merges what the caller owns over the defaults", func(t *testing.T) {
		lister := &fakeLister{items: []v1.Preferences{
			{ObjectMeta: metav1.ObjectMeta{Name: "user-1"}, Spec: v1.PreferencesSpec{Theme: new("dark")}},
			{ObjectMeta: metav1.ObjectMeta{Name: "namespace"}, Spec: v1.PreferencesSpec{Theme: new("light"), Language: new("fr")}},
		}}
		code, body := callMerged(t, &mergedRoute{config: config, lister: lister})
		require.Equal(t, http.StatusOK, code)
		require.Equal(t, "default", lister.ns)

		var got v1.Preferences
		require.NoError(t, json.Unmarshal(body, &got))
		require.Equal(t, "dark", *got.Spec.Theme)
		require.Equal(t, "fr", *got.Spec.Language)
		require.Equal(t, "user-1,namespace", got.Annotations[v1.APIGroup+"/source"])
	})

	t.Run("nothing owned is the defaults", func(t *testing.T) {
		code, body := callMerged(t, &mergedRoute{config: config, lister: &fakeLister{}})
		require.Equal(t, http.StatusOK, code)
		var got v1.Preferences
		require.NoError(t, json.Unmarshal(body, &got))
		require.Equal(t, config.Defaults, got.Spec)
	})

	t.Run("a list error keeps its status", func(t *testing.T) {
		lister := &fakeLister{err: apierrors.NewForbidden(v1.PreferencesResourceInfo.GroupResource(), "", nil)}
		code, _ := callMerged(t, &mergedRoute{config: config, lister: lister})
		require.Equal(t, http.StatusForbidden, code)
	})

	t.Run("without an API connection the route is unavailable", func(t *testing.T) {
		code, _ := callMerged(t, &mergedRoute{config: config})
		require.Equal(t, http.StatusServiceUnavailable, code)
	})
}

// The app and the manifest must agree on what the app serves.
func TestNewMatchesManifest(t *testing.T) {
	_, err := New(app.Config{ManifestData: *manifestdata.LocalManifest().ManifestData})
	require.NoError(t, err)
}
