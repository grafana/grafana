// Package dashboards checks that dashboard history, trash, and restore survive a round
// trip between Grafana versions: each version reads the versions and trash entries the
// other one wrote, and restores what the other one deleted, for dashboards stored in the
// classic v1 schema.
package dashboards

import (
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"net/http"
	"os"
	"path/filepath"
	"slices"
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
	versions := dashboardVersions(t, h)
	ctx := context.Background()

	_, err := resource(h, folderGVR).Create(ctx, &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": folderGVR.GroupVersion().String(),
		"kind":       "Folder",
		"metadata":   map[string]any{"name": folder},
		"spec":       map[string]any{"title": "Compat dashboard folder"},
	}}, metav1.CreateOptions{})
	require.NoError(t, err)

	writes := make(map[string]fixtureWrites, len(roundTrips))
	for _, trip := range roundTrips {
		t.Run(trip.name, func(t *testing.T) {
			c := client{roundTrip: trip, h: h, served: versions}
			w := c.withWriter(t, trip.setup)
			c.writes.Setup = w.apiGroupVersion()
			w.create(t, history, revision(1))
			w.save(t, history, revision(2))
			w.create(t, trashedBySetup, savedRevision{content: trashed[trashedBySetup]})
			w.create(t, trashedByUpdate, savedRevision{content: trashed[trashedByUpdate]})
			editor := c.withWriter(t, trip.edit)
			editor.writes.SetupTrash = editor.deleteToTrash(t, trashedBySetup)

			editor.checkHistory(t, revision(1), revision(2))
			editor.checkTrashed(t, trashedBySetup)
			writes[trip.name] = editor.writes
		})
	}
	saveFixtureWrites(t, writes)
}

// TestCompatUpdate runs on the other version: it reads the history and the trash the
// setup version wrote, saves and rolls back history, restores trashed-by-setup, and
// deletes trashed-by-update.
func TestCompatUpdate(t *testing.T) {
	writes := readFixtureWrites(t)
	require.NoError(t, validateSetupFixtures(writes, compat.IsNewer()))

	h := compat.NewHelper(t)
	versions := dashboardVersions(t, h)
	for _, trip := range roundTrips {
		written, exists := writes[trip.name]
		if !exists {
			// Setup may have run a release from before this fixture was added.
			continue
		}
		t.Run(trip.name, func(t *testing.T) {
			requireWriterVersion(t, versions, written.Setup)
			c := client{roundTrip: trip, h: h, served: versions, writes: written}.withWriter(t, trip.edit)
			c.writes.Update = c.apiGroupVersion()
			c.checkHistory(t, revision(1), revision(2))
			c.save(t, history, revision(3))
			rollback := rolledBackRevision()
			c.rollBack(t, history, 1, rollback.message)
			c.checkHistory(t, revision(1), revision(2), revision(3), rollback)

			c.restore(t, trashedBySetup)

			c.writes.UpdateTrash = c.deleteToTrash(t, trashedByUpdate)
			c.checkTrashed(t, trashedByUpdate)
			writes[trip.name] = c.writes
		})
	}
	saveFixtureWrites(t, writes)
}

// TestCompatVerify runs on the setup version again: it reads what the other version
// wrote, restores trashed-by-update, and deletes everything.
func TestCompatVerify(t *testing.T) {
	h := compat.NewHelper(t)
	versions := dashboardVersions(t, h)
	writes := readFixtureWrites(t)
	ctx := context.Background()
	for _, trip := range roundTrips {
		t.Run(trip.name, func(t *testing.T) {
			written, exists := writes[trip.name]
			require.True(t, exists, "setup did not record fixture %s", trip.name)
			c := client{roundTrip: trip, h: h, served: versions, writes: written}.withWriter(t, trip.edit)
			live := []string{history, trashedByUpdate}
			if written.Update == "" {
				// The other release may predate this fixture.
				c.checkHistory(t, revision(1), revision(2))
				c.checkTrashed(t, trashedBySetup)
				for _, view := range c.views() {
					view.checkLive(t, trashedByUpdate, trashed[trashedByUpdate])
				}
			} else {
				requireWriterVersion(t, versions, written.Update)
				c.checkHistory(t, revision(1), revision(2), revision(3), rolledBackRevision())
				c.checkRestored(t, trashedBySetup, written.Update)
				c.restore(t, trashedByUpdate)
				live = append(live, trashedBySetup)
			}
			for _, name := range live {
				require.NoError(t, c.Delete(ctx, c.fixture(name), metav1.DeleteOptions{}), name)
			}
		})
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

// schemaFamily is one dashboard schema with the API versions that serve it.
type schemaFamily struct {
	stable, beta string
	spec         func(*testing.T, content) map[string]any
	// fieldValidation is what the family's editor sends on save.
	fieldValidation string
}

// apiVersion follows the editor's preference for its schema family.
func (f schemaFamily) apiVersion(t *testing.T, versions []string) string {
	t.Helper()
	version := f.beta
	switch {
	case versions[0] == f.stable || versions[0] == f.beta:
		version = versions[0]
	case slices.Contains(versions, f.stable):
		version = f.stable
	}
	require.Contains(t, versions, version)
	return version
}

type roundTrip struct {
	name        string
	setup, edit schemaFamily
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

func validateSetupFixtures(writes map[string]fixtureWrites, newer bool) error {
	if !newer {
		return nil
	}
	for _, name := range slices.Sorted(maps.Keys(writes)) {
		if !slices.ContainsFunc(roundTrips, func(trip roundTrip) bool { return trip.name == name }) {
			return fmt.Errorf("newer Update does not recognize Setup fixture %q", name)
		}
	}
	return nil
}

const fixtureManifestFile = "dashboard-write-versions.json"

var (
	v1Family = schemaFamily{stable: "v1", beta: "v1beta1", spec: v1Spec, fieldValidation: metav1.FieldValidationIgnore}

	roundTrips = []roundTrip{
		{name: "v1", setup: v1Family, edit: v1Family},
	}
)

func (r roundTrip) fixture(name string) string {
	if r.name == "v1" {
		return "compat-dashboard-" + name
	}
	return "compat-dashboard-" + r.name + "-" + name
}

// client reads or writes a round trip's fixtures in one dashboard API version.
type client struct {
	roundTrip
	writer  schemaFamily
	h       *apis.K8sTestHelper
	version string
	served  []string
	writes  fixtureWrites
	dynamic.ResourceInterface
}

func dashboardVersions(t *testing.T, h *apis.K8sTestHelper) []string {
	t.Helper()
	res, ok := compat.Served(t, h)[dashboardGR]
	require.True(t, ok, "dashboards are not served")
	return res.Versions
}

func requireWriterVersion(t *testing.T, served []string, apiVersion string) {
	t.Helper()
	if !compat.IsNewer() {
		return
	}
	gv, err := schema.ParseGroupVersion(apiVersion)
	require.NoError(t, err)
	require.Equal(t, dashboardGR.Group, gv.Group, "dashboard writer API group in %q", apiVersion)
	require.Contains(t, served, gv.Version, "older Grafana wrote dashboards in %s, which newer Grafana must still serve", apiVersion)
}

func (c client) withWriter(t *testing.T, writer schemaFamily) client {
	t.Helper()
	c.writer = writer
	return c.withVersion(writer.apiVersion(t, c.served))
}

// views reads each fixture through every served version, including new versions that
// do not have a fixture writer or content parser yet.
func (c client) views() []client {
	views := make([]client, 0, len(c.served))
	for _, version := range c.served {
		views = append(views, c.withVersion(version))
	}
	return views
}

func (c client) withVersion(version string) client {
	c.version = version
	c.ResourceInterface = resource(c.h, dashboardGR.WithVersion(version))
	return c
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
		"spec":       c.writeSpec(t, want.content),
	}}, metav1.CreateOptions{})
	require.NoError(t, err, "create %s in %s", c.fixture(name), c.version)
}

// save replaces the dashboard's content with another revision of the same schema.
func (c client) save(t *testing.T, name string, want savedRevision) {
	t.Helper()
	c.saveSpec(t, c.getDashboard(t, name), c.writeSpec(t, want.content), want.message)
}

func (c client) writeSpec(t *testing.T, want content) map[string]any {
	t.Helper()
	return c.writer.spec(t, want)
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
	}}, metav1.UpdateOptions{FieldValidation: c.writer.fieldValidation})
	require.NoError(t, err, "save %s in %s", live.GetName(), c.version)
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
		Path:   c.dashboardsPath(c.version),
		Body:   body,
	}, (*unstructured.Unstructured)(nil))
	require.Equal(t, http.StatusCreated, rsp.Response.StatusCode, "restore %s in %s: %s", c.fixture(name), c.version, rsp.Body)
	var restored unstructured.Unstructured
	require.NoError(t, json.Unmarshal(rsp.Body, &restored), "decode restored %s in %s", c.fixture(name), c.version)
	require.Equal(t, c.fixture(name), restored.GetName(), "restored dashboard in %s", c.version)
	c.checkRestored(t, name, c.apiGroupVersion())
}

// checkHistory checks every saved revision of history, given oldest first, in the order
// the API returns them, and that the live dashboard is the last one, in its folder.
func (c client) checkHistory(t *testing.T, want ...savedRevision) {
	t.Helper()
	for _, v := range c.views() {
		items := v.listRevisions(t, history, utils.LabelKeyGetHistory)
		read := func(obj *unstructured.Unstructured) (content, bool) {
			return v.readContent(t, history, obj)
		}
		require.NoError(t, historyError(items, read, want...), "%s in %s", v.fixture(history), v.version)

		live := v.checkLive(t, history, want[len(want)-1].content)
		require.EqualValues(t, len(want), live.GetGeneration(), "%s in %s", v.fixture(history), v.version)
	}

}

// historyError compares the history entries, which the API returns newest first, with
// the expected revisions, oldest first. The reader reports whether it knows the schema.
func historyError(items []unstructured.Unstructured, read func(*unstructured.Unstructured) (content, bool), want ...savedRevision) error {
	if len(items) != len(want) {
		return fmt.Errorf("want %d history revisions, got %d", len(want), len(items))
	}
	for i := range items {
		generation := len(want) - i
		if got := items[i].GetGeneration(); got != int64(generation) {
			return fmt.Errorf("history, newest first: want generation %d at index %d, got %d", generation, i, got)
		}
		expected := want[generation-1]
		if message := items[i].GetAnnotations()[utils.AnnoKeyMessage]; message != expected.message {
			return fmt.Errorf("history generation %d: want message %q, got %q", generation, expected.message, message)
		}
		if got, known := read(&items[i]); known && got != expected.content {
			return fmt.Errorf("history generation %d: want %+v, got %+v", generation, expected.content, got)
		}
	}
	return nil
}

func (c client) deleteToTrash(t *testing.T, name string) trashMetadata {
	t.Helper()
	live := c.getDashboard(t, name)
	legacyID := live.GetLabels()[utils.LabelKeyDeprecatedInternalID] //nolint:staticcheck // The restore must preserve this legacy ID.
	require.NotEmpty(t, legacyID, "legacy ID of %s before delete", c.fixture(name))
	require.NoError(t, c.Delete(context.Background(), c.fixture(name), metav1.DeleteOptions{}))
	obj := c.trashEntry(t, name)
	require.NotNil(t, obj, "%s in the trash in %s", c.fixture(name), c.version)
	deletedAt := obj.GetDeletionTimestamp()
	require.NotNil(t, deletedAt, "deletion timestamp of %s", c.fixture(name))
	require.False(t, deletedAt.IsZero(), "deletion timestamp of %s", c.fixture(name))
	return trashMetadata{
		LegacyID:        legacyID,
		DeletedBy:       c.h.Org1.Admin.Identity.GetUID(),
		DeletedAtMillis: deletedAt.UnixMilli(),
	}
}

// checkTrashed returns the validated trash entry in the editing API's version for restore.
func (c client) checkTrashed(t *testing.T, name string) *unstructured.Unstructured {
	t.Helper()
	want, _ := c.expectedTrash(name)
	wantTrash := c.expectedTrashMetadata(name)
	require.NotEmpty(t, wantTrash.LegacyID, "manifest legacy ID for %s", c.fixture(name))
	var forRestore *unstructured.Unstructured
	for _, v := range c.views() {
		_, err := v.Get(context.Background(), v.fixture(name), metav1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err), "%s after delete: expected not found, got %v", v.fixture(name), err)
		obj := v.trashEntry(t, name)
		require.NotNil(t, obj, "%s in the trash in %s", v.fixture(name), v.version)
		v.checkDashboard(t, name, obj, want)
		require.Equal(t, wantTrash.LegacyID, obj.GetLabels()[utils.LabelKeyDeprecatedInternalID], //nolint:staticcheck
			"legacy ID of %s in the trash in %s", v.fixture(name), v.version)
		require.Equal(t, wantTrash.DeletedBy, obj.GetAnnotations()[utils.AnnoKeyUpdatedBy],
			"deleter of %s in the trash in %s", v.fixture(name), v.version)
		deletedAt := obj.GetDeletionTimestamp()
		require.NotNil(t, deletedAt, "deletion timestamp of %s in %s", v.fixture(name), v.version)
		require.Equal(t, wantTrash.DeletedAtMillis, deletedAt.UnixMilli(),
			"deletion timestamp of %s in %s", v.fixture(name), v.version)
		if v.version == c.version {
			forRestore = obj
		}
	}
	require.NotNil(t, forRestore, "%s in the trash in %s", c.fixture(name), c.version)
	return forRestore
}

func (c client) expectedTrash(name string) (content, string) {
	return trashed[name], c.writes.Setup
}

func (c client) expectedTrashMetadata(name string) trashMetadata {
	if name == trashedByUpdate {
		return c.writes.UpdateTrash
	}
	return c.writes.SetupTrash
}

// checkRestored checks a restored dashboard: it is back in its folder with its content,
// and no longer in the trash.
func (c client) checkRestored(t *testing.T, name, writerAPIVersion string) {
	t.Helper()
	want, _ := c.expectedTrash(name)
	legacyID := c.expectedTrashMetadata(name).LegacyID
	require.NotEmpty(t, legacyID, "manifest legacy ID for %s", c.fixture(name))
	for _, v := range c.views() {
		obj := v.checkLive(t, name, want)
		require.Equal(t, legacyID, obj.GetLabels()[utils.LabelKeyDeprecatedInternalID], //nolint:staticcheck
			"legacy ID of restored %s in %s", v.fixture(name), v.version)
		require.Nil(t, v.trashEntry(t, name), "%s in the trash after restore in %s", v.fixture(name), v.version)
	}
}

func (c client) getDashboard(t *testing.T, name string) *unstructured.Unstructured {
	t.Helper()
	obj, err := c.Get(context.Background(), c.fixture(name), metav1.GetOptions{})
	require.NoError(t, err, "get %s in %s", c.fixture(name), c.version)
	require.Equal(t, c.fixture(name), obj.GetName(), "get dashboard in %s", c.version)
	return obj
}

func (c client) checkLive(t *testing.T, name string, want content) *unstructured.Unstructured {
	t.Helper()
	obj := c.getDashboard(t, name)
	c.checkDashboard(t, name, obj, want)
	return obj
}

func (c client) checkDashboard(t *testing.T, name string, obj *unstructured.Unstructured, want content) {
	t.Helper()
	if got, known := c.readContent(t, name, obj); known {
		require.Equal(t, want, got, "%s in %s", c.fixture(name), c.version)
	}
	require.Equal(t, folder, obj.GetAnnotations()[utils.AnnoKeyFolder], "folder of %s in %s", c.fixture(name), c.version)
}

func (c client) readContent(t *testing.T, name string, obj *unstructured.Unstructured) (content, bool) {
	t.Helper()
	spec := c.dashboardSpec(t, name, obj)
	var got content
	var err error
	switch c.version {
	case "v0alpha1", "v1", "v1beta1":
		got, err = parseV1(spec, false)
	default:
		return content{}, false
	}
	require.NoError(t, err, "%s in %s", c.fixture(name), c.version)
	return got, true
}

// dashboardSpec validates the common response before returning the version-specific spec.
func (c client) dashboardSpec(t *testing.T, name string, obj *unstructured.Unstructured) map[string]any {
	t.Helper()
	require.Equal(t, c.fixture(name), obj.GetName(), "dashboard in %s", c.version)
	require.Equal(t, c.apiGroupVersion(), obj.GetAPIVersion(), "%s", c.fixture(name))
	require.Equal(t, "Dashboard", obj.GetKind(), "%s in %s", c.fixture(name), c.version)
	failed, _, err := unstructured.NestedBool(obj.Object, "status", "conversion", "failed")
	require.NoError(t, err, "%s in %s", c.fixture(name), c.version)
	if failed {
		msg, _, _ := unstructured.NestedString(obj.Object, "status", "conversion", "error")
		t.Fatalf("%s in %s: conversion failed: %s", c.fixture(name), c.version, msg)
	}
	spec, _, err := unstructured.NestedMap(obj.Object, "spec")
	require.NoError(t, err, "%s in %s", c.fixture(name), c.version)
	require.NotEmpty(t, spec, "%s spec in %s", c.fixture(name), c.version)
	return spec
}

func (c client) apiGroupVersion() string {
	return dashboardGR.WithVersion(c.version).GroupVersion().String()
}

func (c client) dashboardsPath(version string) string {
	namespace := c.h.Namespacer(c.h.Org1.Admin.Identity.GetOrgID())
	return fmt.Sprintf("/apis/%s/namespaces/%s/%s", dashboardGR.WithVersion(version).GroupVersion(), namespace, dashboardGR.Resource)
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
	require.NoError(t, err, "%s in %s with %s", c.fixture(name), c.version, label)
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
			"gridPos": classicGridPosition(0, panelWidth, panelHeight),
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
