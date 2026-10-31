package app

import (
	"slices"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

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

func fromUnstructured(t *testing.T, obj runtime.Object) *v1.Preferences {
	t.Helper()
	u, ok := obj.(*unstructured.Unstructured)
	require.True(t, ok, "%T", obj)
	require.Equal(t, v1.APIGroup+"/"+v1.APIVersion, u.GetAPIVersion())
	require.Equal(t, "Preferences", u.GetKind())
	var p v1.Preferences
	require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(u.Object, &p))
	return &p
}

func TestMergedGetter(t *testing.T) {
	config := &Config{Defaults: v1.PreferencesSpec{Theme: new("settings.ini"), Language: new("settings.ini")}}
	get := config.MergedGetter()

	stored := func(name string, spec v1.PreferencesSpec) runtime.Object {
		obj := &v1.Preferences{ObjectMeta: metav1.ObjectMeta{Name: name}, Spec: spec}
		raw, err := runtime.DefaultUnstructuredConverter.ToUnstructured(obj)
		require.NoError(t, err)
		return &unstructured.Unstructured{Object: raw}
	}

	t.Run("merges what the caller owns over the defaults", func(t *testing.T) {
		obj, err := get(t.Context(), "merged", []runtime.Object{
			stored("user-1", v1.PreferencesSpec{Theme: new("dark")}),
			stored("namespace", v1.PreferencesSpec{Theme: new("light"), Language: new("fr")}),
		})
		require.NoError(t, err)
		merged := fromUnstructured(t, obj)
		require.Equal(t, "dark", *merged.Spec.Theme)
		require.Equal(t, "fr", *merged.Spec.Language)
		require.Equal(t, "user-1,namespace", merged.Annotations[v1.APIGroup+"/source"])
	})

	t.Run("typed objects merge too", func(t *testing.T) {
		obj, err := get(t.Context(), "merged", []runtime.Object{&v1.Preferences{Spec: v1.PreferencesSpec{Theme: new("dark")}}})
		require.NoError(t, err)
		require.Equal(t, "dark", *fromUnstructured(t, obj).Spec.Theme)
	})

	t.Run("nothing owned is the defaults", func(t *testing.T) {
		obj, err := get(t.Context(), "merged", nil)
		require.NoError(t, err)
		require.Equal(t, config.Defaults, fromUnstructured(t, obj).Spec)
	})

	t.Run("only merged is answered", func(t *testing.T) {
		_, err := get(t.Context(), "other", nil)
		require.True(t, apierrors.IsNotFound(err))
	})

	t.Run("an object that is not preferences is an error", func(t *testing.T) {
		_, err := get(t.Context(), "merged", []runtime.Object{&metav1.Status{}})
		require.Error(t, err)
	})
}

// The app and the manifest must agree on what the app serves.
func TestNewMatchesManifest(t *testing.T) {
	_, err := New(app.Config{ManifestData: *manifestdata.LocalManifest().ManifestData})
	require.NoError(t, err)
}
