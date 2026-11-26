// Package dashboards checks that dashboard history, trash, and restore survive a round
// trip between Grafana versions: each version reads the versions and trash entries the
// other one wrote, and restores what the other one deleted, for dashboards stored in the
// classic v1 schema.
package dashboards

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/compat"
)

func TestMain(m *testing.M) {
	compat.Main(m)
}

// TestCompatSetup creates the folder and the dashboards, saves history twice, and
// deletes trashed-by-setup.
func TestCompatSetup(t *testing.T) {
	h := compat.NewHelper(t)
	ctx := context.Background()

	_, err := resource(h, folderGVR).Create(ctx, &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": folderGVR.GroupVersion().String(),
		"kind":       "Folder",
		"metadata":   map[string]any{"name": folder},
		"spec":       map[string]any{"title": "Compat dashboard folder"},
	}}, metav1.CreateOptions{})
	require.NoError(t, err)

	c := newClient(h, fixtureWrites{})
	c.writes.Setup = c.apiGroupVersion()
	c.create(t, history, revision(1))
	c.save(t, history, revision(2))
	c.create(t, trashedBySetup, savedRevision{content: trashed[trashedBySetup]})
	c.create(t, trashedByUpdate, savedRevision{content: trashed[trashedByUpdate]})
	c.writes.SetupTrash = c.deleteToTrash(t, trashedBySetup)
	c.checkHistory(t, revision(1), revision(2))
	c.checkTrashed(t, trashedBySetup)
	saveFixtureWrites(t, map[string]fixtureWrites{"v1": c.writes})
}

// TestCompatUpdate runs on the other version: it reads the history and the trash the
// setup version wrote, saves and rolls back history, restores trashed-by-setup, and
// deletes trashed-by-update.
func TestCompatUpdate(t *testing.T) {
	writes := readFixtureWrites(t)

	h := compat.NewHelper(t)
	c := newClient(h, writes["v1"])
	c.writes.Update = c.apiGroupVersion()
	c.checkHistory(t, revision(1), revision(2))
	c.save(t, history, revision(3))
	rollback := rolledBackRevision()
	c.rollBack(t, history, 1, rollback.message)
	c.checkHistory(t, revision(1), revision(2), revision(3), rollback)
	c.restore(t, trashedBySetup)
	c.writes.UpdateTrash = c.deleteToTrash(t, trashedByUpdate)
	c.checkTrashed(t, trashedByUpdate)
	writes["v1"] = c.writes
	saveFixtureWrites(t, writes)
}

// TestCompatVerify runs on the setup version again: it reads what the other version
// wrote, restores trashed-by-update, and deletes everything.
func TestCompatVerify(t *testing.T) {
	h := compat.NewHelper(t)
	c := newClient(h, readFixtureWrites(t)["v1"])
	c.checkHistory(t, revision(1), revision(2), revision(3), rolledBackRevision())
	c.checkRestored(t, trashedBySetup)
	c.restore(t, trashedByUpdate)
	ctx := context.Background()
	for _, name := range []string{history, trashedBySetup, trashedByUpdate} {
		require.NoError(t, c.Delete(ctx, c.fixture(name), metav1.DeleteOptions{}), name)
	}
	require.NoError(t, resource(h, folderGVR).Delete(ctx, folder, metav1.DeleteOptions{}))
}

var (
	dashboardGR = schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"}
	folderGVR   = schema.GroupVersionResource{Group: "folder.grafana.app", Version: "v1", Resource: "folders"}
)

// Fixture names and values are a contract with older versions: they verify them as
// written here, so change or remove them only together with those versions.
//
// Setup creates three classic dashboard fixtures.
//
//	history          saved twice, as revision 1 and 2
//	trashed-by-setup deleted right away
//	trashed-by-update
//
// Update saves history as revision 3 and then rolls it back to revision 1, restores
// trashed-by-setup, and deletes trashed-by-update.
// Verify restores trashed-by-update.
// Every revision changes the title, the panel title, and the panel's query, and every
// panel names its visualization and Prometheus datasource, so a version that drops the
// panel or its plugin bindings while reading history or trash fails.
const (
	folder          = "compat-dashboard-folder"
	history         = "history"
	trashedBySetup  = "trashed-by-setup"
	trashedByUpdate = "trashed-by-update"
	panelWidth      = 12
	panelHeight     = 8
)

// content is what each check expects a dashboard to hold.
type content struct {
	Title, Panel, Query string
	// Viz is the panel plugin, Datasource the datasource type and UID of the query.
	Viz, DatasourceType, DatasourceUID string
}

func panel(title, panelTitle, query string) content {
	return content{
		Title: title, Panel: panelTitle, Query: query,
		Viz: "timeseries", DatasourceType: "prometheus", DatasourceUID: "compat-prometheus",
	}
}

type savedRevision struct {
	content
	message string
}

func revision(n int) savedRevision {
	return savedRevision{
		content: panel(fmt.Sprintf("History %d", n), fmt.Sprintf("Panel %d", n), fmt.Sprintf(`up{revision="%d"}`, n)),
		message: fmt.Sprintf("Save revision %d", n),
	}
}

func rolledBackRevision() savedRevision {
	return savedRevision{content: revision(1).content, message: "Restore revision 1"}
}

var trashed = map[string]content{
	trashedBySetup:  panel("Compat trashed by setup", "Trashed by setup", `up{trashed="setup"}`),
	trashedByUpdate: panel("Compat trashed by update", "Trashed by update", `up{trashed="update"}`),
}

// fixtureWrites carries the selected API versions and trash metadata from
// the writing phase to the next phase.
type fixtureWrites struct {
	Setup  string
	Update string

	SetupTrash  trashMetadata `json:",omitzero"`
	UpdateTrash trashMetadata `json:",omitzero"`
}

type trashMetadata struct {
	LegacyID        string
	DeletedBy       string
	DeletedAtMillis int64
}

func readFixtureWrites(t *testing.T) map[string]fixtureWrites {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(compat.Dir(t), fixtureManifestFile))
	require.NoError(t, err)
	var writes map[string]fixtureWrites
	require.NoError(t, json.Unmarshal(data, &writes))
	require.NotEmpty(t, writes, "setup fixture manifest")
	return writes
}

func saveFixtureWrites(t *testing.T, writes map[string]fixtureWrites) {
	t.Helper()
	data, err := json.Marshal(writes)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(compat.Dir(t), fixtureManifestFile), data, 0o600))
}

const fixtureManifestFile = "dashboard-write-versions.json"

type client struct {
	h      *apis.K8sTestHelper
	writes fixtureWrites
	dynamic.ResourceInterface
}

func newClient(h *apis.K8sTestHelper, writes fixtureWrites) client {
	return client{h: h, writes: writes, ResourceInterface: resource(h, dashboardGR.WithVersion("v1"))}
}

func (c client) fixture(name string) string {
	return "compat-dashboard-" + name
}

func (c client) create(t *testing.T, name string, want savedRevision) {
	t.Helper()
	annotations := map[string]any{utils.AnnoKeyFolder: folder}
	if want.message != "" {
		annotations[utils.AnnoKeyMessage] = want.message
	}
	_, err := c.Create(context.Background(), &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": c.apiGroupVersion(),
		"kind":       "Dashboard",
		"metadata":   map[string]any{"name": c.fixture(name), "annotations": annotations},
		"spec":       v1Spec(t, want.content),
	}}, metav1.CreateOptions{})
	require.NoError(t, err, "create %s", c.fixture(name))
}

// save replaces the dashboard's content with another revision of the same schema.
func (c client) save(t *testing.T, name string, want savedRevision) {
	t.Helper()
	c.saveSpec(t, c.getDashboard(t, name), v1Spec(t, want.content), want.message)
}

// saveSpec sends the update the dashboard editor sends: it keeps the folder, sets the
// spec, and leaves out the resourceVersion, so the save does not depend on it.
func (c client) saveSpec(t *testing.T, live *unstructured.Unstructured, spec map[string]any, message string) {
	t.Helper()
	_, err := c.Update(context.Background(), &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": c.apiGroupVersion(),
		"kind":       "Dashboard",
		"metadata": map[string]any{"name": live.GetName(), "annotations": map[string]any{
			utils.AnnoKeyFolder:           live.GetAnnotations()[utils.AnnoKeyFolder],
			utils.AnnoKeyGrantPermissions: "default",
			utils.AnnoKeyMessage:          message,
		}},
		"spec": spec,
	}}, metav1.UpdateOptions{FieldValidation: metav1.FieldValidationIgnore})
	require.NoError(t, err, "save %s", live.GetName())
}

// rollBack saves the spec of an earlier revision as a new one, as the version history
// view does.
func (c client) rollBack(t *testing.T, name string, generation int64, message string) {
	t.Helper()
	var oldSpec map[string]any
	for _, item := range c.listRevisions(t, name, utils.LabelKeyGetHistory) {
		spec := c.dashboardSpec(t, name, &item)
		if item.GetGeneration() == generation {
			oldSpec = spec
		}
	}
	require.NotNil(t, oldSpec, "revision %d of %s in its history", generation, c.fixture(name))
	c.saveSpec(t, c.getDashboard(t, name), oldSpec, message)
}

// restore recreates a deleted dashboard from its trash entry, as the recently deleted
// view does.
func (c client) restore(t *testing.T, name string) {
	t.Helper()
	obj := c.checkTrashed(t, name)
	metadata, _, err := unstructured.NestedMap(obj.Object, "metadata")
	require.NoError(t, err, "trash metadata for %s", c.fixture(name))
	metadata["resourceVersion"] = ""
	require.NoError(t, unstructured.SetNestedField(metadata, "default", "annotations", utils.AnnoKeyGrantPermissions))
	body, err := json.Marshal(map[string]any{"metadata": metadata, "spec": obj.Object["spec"]})
	require.NoError(t, err, "restore payload for %s", c.fixture(name))
	rsp := apis.DoRequest(c.h, apis.RequestParams{
		User:   c.h.Org1.Admin,
		Method: http.MethodPost,
		Path:   c.dashboardsPath(),
		Body:   body,
	}, (*unstructured.Unstructured)(nil))
	require.Equal(t, http.StatusCreated, rsp.Response.StatusCode, "restore %s: %s", c.fixture(name), rsp.Body)
	var restored unstructured.Unstructured
	require.NoError(t, json.Unmarshal(rsp.Body, &restored), "decode restored %s", c.fixture(name))
	require.Equal(t, c.fixture(name), restored.GetName(), "restored dashboard")
	c.checkRestored(t, name)
}

// checkHistory compares the saved revisions in the newest-first order used by the API.
func (c client) checkHistory(t *testing.T, want ...savedRevision) {
	t.Helper()
	items := c.listRevisions(t, history, utils.LabelKeyGetHistory)
	require.Len(t, items, len(want))
	for i := range items {
		generation := len(want) - i
		require.Equal(t, int64(generation), items[i].GetGeneration())
		revision := want[generation-1]
		require.Equal(t, revision.message, items[i].GetAnnotations()[utils.AnnoKeyMessage])
		c.checkDashboard(t, history, &items[i], revision.content)
	}
	live := c.getDashboard(t, history)
	require.Equal(t, int64(len(want)), live.GetGeneration())
	c.checkDashboard(t, history, live, want[len(want)-1].content)
}

func (c client) deleteToTrash(t *testing.T, name string) trashMetadata {
	t.Helper()
	live := c.getDashboard(t, name)
	legacyID := live.GetLabels()[utils.LabelKeyDeprecatedInternalID] //nolint:staticcheck // The restore must preserve this legacy ID.
	require.NotEmpty(t, legacyID, "legacy ID of %s before delete", c.fixture(name))
	require.NoError(t, c.Delete(context.Background(), c.fixture(name), metav1.DeleteOptions{}))
	obj := c.trashEntry(t, name)
	require.NotNil(t, obj, "%s in the trash in %s", c.fixture(name), "v1")
	deletedAt := obj.GetDeletionTimestamp()
	require.NotNil(t, deletedAt, "deletion timestamp of %s", c.fixture(name))
	require.False(t, deletedAt.IsZero(), "deletion timestamp of %s", c.fixture(name))
	return trashMetadata{
		LegacyID:        legacyID,
		DeletedBy:       c.h.Org1.Admin.Identity.GetUID(),
		DeletedAtMillis: deletedAt.UnixMilli(),
	}
}

// checkTrashed returns the trash entry for restore.
func (c client) checkTrashed(t *testing.T, name string) *unstructured.Unstructured {
	t.Helper()
	_, err := c.Get(context.Background(), c.fixture(name), metav1.GetOptions{})
	require.True(t, apierrors.IsNotFound(err), "%s after delete: expected not found, got %v", name, err)
	obj := c.trashEntry(t, name)
	require.NotNil(t, obj, "%s in the trash", name)
	c.checkDashboard(t, name, obj, trashed[name])
	return obj
}

func (c client) checkRestored(t *testing.T, name string) {
	t.Helper()
	c.checkDashboard(t, name, c.getDashboard(t, name), trashed[name])
	require.Nil(t, c.trashEntry(t, name), "%s in the trash after restore", name)
}

func (c client) getDashboard(t *testing.T, name string) *unstructured.Unstructured {
	t.Helper()
	obj, err := c.Get(context.Background(), c.fixture(name), metav1.GetOptions{})
	require.NoError(t, err, "get %s", c.fixture(name))
	require.Equal(t, c.fixture(name), obj.GetName(), "get dashboard")
	return obj
}

func (c client) checkDashboard(t *testing.T, name string, obj *unstructured.Unstructured, want content) {
	t.Helper()
	spec := c.dashboardSpec(t, name, obj)
	title, _, err := unstructured.NestedString(spec, "title")
	require.NoError(t, err)
	require.Equal(t, want.Title, title, "%s title", name)
	require.Equal(t, folder, obj.GetAnnotations()[utils.AnnoKeyFolder], "%s folder", name)
}

// dashboardSpec validates the common response before returning the version-specific spec.
func (c client) dashboardSpec(t *testing.T, name string, obj *unstructured.Unstructured) map[string]any {
	t.Helper()
	require.Equal(t, c.fixture(name), obj.GetName(), "dashboard in %s", "v1")
	require.Equal(t, c.apiGroupVersion(), obj.GetAPIVersion(), "%s", c.fixture(name))
	require.Equal(t, "Dashboard", obj.GetKind(), "%s", c.fixture(name))
	failed, _, err := unstructured.NestedBool(obj.Object, "status", "conversion", "failed")
	require.NoError(t, err, "%s", c.fixture(name))
	if failed {
		msg, _, _ := unstructured.NestedString(obj.Object, "status", "conversion", "error")
		t.Fatalf("%s in %s: conversion failed: %s", c.fixture(name), "v1", msg)
	}
	spec, _, err := unstructured.NestedMap(obj.Object, "spec")
	require.NoError(t, err, "%s", c.fixture(name))
	require.NotEmpty(t, spec, "%s spec in %s", c.fixture(name), "v1")
	return spec
}

func (c client) apiGroupVersion() string {
	return dashboardGR.WithVersion("v1").GroupVersion().String()
}

func (c client) dashboardsPath() string {
	namespace := c.h.Namespacer(c.h.Org1.Admin.Identity.GetOrgID())
	return fmt.Sprintf("/apis/%s/namespaces/%s/%s", c.apiGroupVersion(), namespace, dashboardGR.Resource)
}

func (c client) trashEntry(t *testing.T, name string) *unstructured.Unstructured {
	t.Helper()
	for _, item := range c.listRevisions(t, name, utils.LabelKeyGetTrash) {
		if item.GetName() == c.fixture(name) {
			return &item
		}
	}
	return nil
}

func (c client) listRevisions(t *testing.T, name, label string) []unstructured.Unstructured {
	t.Helper()
	list, err := c.List(context.Background(), metav1.ListOptions{
		LabelSelector: label + "=true",
		FieldSelector: "metadata.name=" + c.fixture(name),
	})
	require.NoError(t, err, "%s with %s", c.fixture(name), label)
	require.Equal(t, c.apiGroupVersion(), list.GetAPIVersion(), "%s list with %s", c.fixture(name), label)
	return list.Items
}

func v1Spec(_ *testing.T, c content) map[string]any {
	return map[string]any{
		"title":         c.Title,
		"schemaVersion": int64(41),
		"panels": []any{map[string]any{
			"id":      int64(1),
			"title":   c.Panel,
			"gridPos": map[string]any{"x": int64(0), "y": int64(0), "w": int64(panelWidth), "h": int64(panelHeight)},
			"type":    c.Viz,
			"targets": []any{map[string]any{
				"refId":      "A",
				"expr":       c.Query,
				"datasource": map[string]any{"type": c.DatasourceType, "uid": c.DatasourceUID},
			}},
		}},
	}
}

func resource(h *apis.K8sTestHelper, gvr schema.GroupVersionResource) dynamic.ResourceInterface {
	return h.GetResourceClient(apis.ResourceClientArgs{User: h.Org1.Admin, GVR: gvr}).Resource
}
