package app

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/apps/collections/pkg/apis/collections/v1alpha1"
	"github.com/grafana/grafana/apps/collections/pkg/apis/manifestdata"
)

type fakeStars struct {
	created, updated *v1alpha1.Stars
	deleted          *resource.Identifier
	err              error
}

func (f *fakeStars) Create(_ context.Context, obj *v1alpha1.Stars, _ resource.CreateOptions) (*v1alpha1.Stars, error) {
	f.created = obj
	return obj, f.err
}

func (f *fakeStars) Update(_ context.Context, obj *v1alpha1.Stars, _ resource.UpdateOptions) (*v1alpha1.Stars, error) {
	f.updated = obj
	return obj, f.err
}

func (f *fakeStars) Delete(_ context.Context, id resource.Identifier, _ resource.DeleteOptions) error {
	f.deleted = &id
	return f.err
}

func starsParent(t *testing.T, name string, items ...string) *app.RawObject {
	t.Helper()
	stars := &v1alpha1.Stars{ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "default", ResourceVersion: "7"}}
	for _, id := range items {
		stars.Spec.Add("dashboard.grafana.app", "Dashboard", id)
	}
	raw, err := json.Marshal(stars)
	require.NoError(t, err)
	return &app.RawObject{Raw: raw}
}

func call(t *testing.T, client starsClient, method, name, path string, parent *app.RawObject) (int, metav1.Status) {
	t.Helper()
	u, err := url.Parse("/apis/collections.grafana.app/v1alpha1/namespaces/default/stars/" + name + path)
	require.NoError(t, err)
	req := &app.CustomRouteRequest{URL: u, Method: method, Parent: parent}
	req.ResourceIdentifier.Name = name
	req.ResourceIdentifier.Namespace = "default"

	w := httptest.NewRecorder()
	require.NoError(t, (&starsRoutes{client: client}).update(t.Context(), w, req))
	var status metav1.Status
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &status))
	return w.Code, status
}

const addPath = "/update/dashboard.grafana.app/Dashboard/abc"

func TestStarsUpdate(t *testing.T) {
	t.Run("the first star creates the object", func(t *testing.T) {
		client := &fakeStars{}
		code, _ := call(t, client, http.MethodPut, "user-1", addPath, nil)
		require.Equal(t, http.StatusOK, code)
		require.NotNil(t, client.created)
		require.Equal(t, "user-1", client.created.Name)
		require.Equal(t, "default", client.created.Namespace)
		require.Equal(t, []string{"abc"}, client.created.Spec.Resource[0].Names)
	})

	t.Run("a later star updates the stored object", func(t *testing.T) {
		client := &fakeStars{}
		code, _ := call(t, client, http.MethodPut, "user-1", addPath, starsParent(t, "user-1", "xyz"))
		require.Equal(t, http.StatusOK, code)
		require.NotNil(t, client.updated)
		require.ElementsMatch(t, []string{"abc", "xyz"}, client.updated.Spec.Resource[0].Names)
	})

	t.Run("removing the last star deletes the object", func(t *testing.T) {
		client := &fakeStars{}
		code, _ := call(t, client, http.MethodDelete, "user-1", addPath, starsParent(t, "user-1", "abc"))
		require.Equal(t, http.StatusOK, code)
		require.Equal(t, &resource.Identifier{Namespace: "default", Name: "user-1"}, client.deleted)
	})

	t.Run("removing from nothing is a no-op", func(t *testing.T) {
		client := &fakeStars{}
		code, _ := call(t, client, http.MethodDelete, "user-1", addPath, nil)
		require.Equal(t, http.StatusOK, code)
		require.Nil(t, client.deleted)
		require.Nil(t, client.created)
	})

	t.Run("only user stars are written", func(t *testing.T) {
		code, status := call(t, &fakeStars{}, http.MethodPut, "team-1", addPath, nil)
		require.Equal(t, http.StatusBadRequest, code)
		require.Equal(t, metav1.StatusFailure, status.Status)
	})

	t.Run("the item must have a group, kind and id", func(t *testing.T) {
		code, _ := call(t, &fakeStars{}, http.MethodPut, "user-1", "/update/dashboard.grafana.app/Dashboard", nil)
		require.Equal(t, http.StatusBadRequest, code)
	})

	t.Run("storage errors keep their status", func(t *testing.T) {
		client := &fakeStars{err: apierrors.NewConflict(schema.GroupResource{Group: v1alpha1.APIGroup, Resource: "stars"}, "user-1", nil)}
		code, _ := call(t, client, http.MethodPut, "user-1", addPath, starsParent(t, "user-1", "xyz"))
		require.Equal(t, http.StatusConflict, code)
	})

	t.Run("without an API connection the route is unavailable", func(t *testing.T) {
		u, _ := url.Parse("/x" + addPath)
		req := &app.CustomRouteRequest{URL: u, Method: http.MethodPut}
		w := httptest.NewRecorder()
		require.NoError(t, (&starsRoutes{}).update(t.Context(), w, req))
		require.Equal(t, http.StatusServiceUnavailable, w.Code)
	})
}

func TestMutateStarsNormalizes(t *testing.T) {
	stars := &v1alpha1.Stars{}
	stars.Spec.Resource = []v1alpha1.StarsResource{
		{Group: "dashboard.grafana.app", Kind: "Dashboard", Names: []string{"b", "a", "b"}},
		{Group: "dashboard.grafana.app", Kind: "Folder"},
	}
	res, err := mutateStars(t.Context(), &app.AdmissionRequest{Object: stars})
	require.NoError(t, err)
	got := res.UpdatedObject.(*v1alpha1.Stars)
	require.Len(t, got.Spec.Resource, 1, "an entry without names is dropped")
	require.Equal(t, []string{"b", "a"}, got.Spec.Resource[0].Names, "duplicates are removed")
}

// The app and the manifest must agree on what the app serves.
func TestNewMatchesManifest(t *testing.T) {
	manifest := manifestdata.LocalManifest().ManifestData
	_, err := New(app.Config{ManifestData: *manifest})
	require.NoError(t, err)
}
