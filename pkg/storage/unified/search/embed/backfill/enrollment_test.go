package backfill

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/dashboard"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/enrollment"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

type countingProvider struct {
	embed.BuilderProvider
	snapshots int
}

func (p *countingProvider) Snapshot() embed.BuilderSnapshot {
	p.snapshots++
	return p.BuilderProvider.Snapshot()
}

func folderManifest(revision int, fields ...app.ManifestVersionKindEmbedField) *app.ManifestData {
	return &app.ManifestData{
		Group: "folder.grafana.app",
		Embed: map[string]app.ManifestResourceEmbed{"folders": {ReembedVersion: revision}},
		Versions: []app.ManifestVersion{{
			Name: "v1",
			Kinds: []app.ManifestVersionKind{{
				Kind: "Folder", Plural: "folders", Embed: &app.ManifestVersionKindEmbed{Fields: fields},
			}},
		}},
	}
}

type enrollmentBackfillTest struct {
	configs    *resource.EmbeddingConfigRegistry
	provider   *countingProvider
	storage    *fakeStorage
	vec        *fakeVector
	text       *fakeText
	backfiller *VectorBackfiller
}

func setupEnrollmentBackfillTest(t *testing.T, allowed []string, custom []embed.Builder) *enrollmentBackfillTest {
	t.Helper()
	configs := resource.NewEmbeddingConfigRegistry(nil)
	registry, err := enrollment.New(configs, allowed, custom, nil)
	require.NoError(t, err)
	f := &enrollmentBackfillTest{
		configs:  configs,
		provider: &countingProvider{BuilderProvider: registry},
		storage:  newFakeStorage(),
		vec:      newFakeVector(),
		text:     &fakeText{dim: 4},
	}
	f.backfiller, err = NewVectorBackfiller(Options{
		Storage: f.storage, VectorBackend: f.vec,
		BatchEmbedder: embedder.NewBatchEmbedder(*newFakeEmbedder(f.text)), BuilderProvider: f.provider,
	})
	require.NoError(t, err)
	assert.Zero(t, f.provider.snapshots, "live manifests need not be available during construction")
	return f
}

func (f *enrollmentBackfillTest) seedFolders(items ...listItem) {
	f.storage.listItems = items
	for _, item := range items {
		f.storage.resources[storeKey(item.Namespace, "folder.grafana.app", "folders", item.Name)] = storedResource{Value: item.Value, RV: item.RV}
	}
}

type backfillIteration struct {
	upserts       int
	completedJobs []int64
}

func (f *enrollmentBackfillTest) run(t *testing.T, want backfillIteration) {
	t.Helper()
	upserts, completed, snapshots := len(f.vec.upserts), len(f.vec.completedJobIDs), f.provider.snapshots
	f.backfiller.runBackfill(t.Context())
	assert.Empty(t, f.vec.errorMarks, "backfill iterations should complete without errors")
	require.Len(t, f.vec.upserts[upserts:], want.upserts, "new upserts in this iteration")
	require.Len(t, f.vec.completedJobIDs[completed:], len(want.completedJobs), "jobs completed in this iteration")
	for i, id := range want.completedJobs {
		assert.Equal(t, id, f.vec.completedJobIDs[completed+i])
	}
	assert.Equal(t, snapshots+1, f.provider.snapshots, "one immutable declaration snapshot per backfill run")
}

func TestRuntimeEnrollmentAndCatalogPartition(t *testing.T) {
	f := setupEnrollmentBackfillTest(t, []string{"folder.grafana.app/folders"}, nil)
	f.seedFolders(
		listItem{Namespace: "ns", Name: "known", RV: 50, Value: []byte(`{"apiVersion":"folder.grafana.app/v1","spec":{"title":"Operations","description":"Production dashboards"}}`)},
		listItem{Namespace: "ns", Name: "unknown", RV: 60, Value: []byte(`{"apiVersion":"folder.grafana.app/v2","metadata":{"annotations":{"grafana.app/folder":"new-parent"}}}`)},
	)
	f.storage.seedFolder("ns", "new-parent", "New parent")
	vec := f.vec
	vec.collections = map[string]vector.Collection{
		"folder.grafana.app/folders": {Group: "folder.grafana.app", Resource: "folders", PartitionKey: "folder_partition"},
	}
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", Resource: "folder_partition", StoppingRV: 100}}
	vec.latestRV = 100
	vec.seedStoredContent("ns", "test-model", "folder_partition", "unknown", "", "Previously embedded", 0)
	oldUnknown := vec.rows[rowsKey("ns", "test-model", "folder_partition", "unknown")][""]
	oldUnknown.Folder = "old-parent"
	vec.rows[rowsKey("ns", "test-model", "folder_partition", "unknown")][""] = oldUnknown

	f.run(t, backfillIteration{})
	assert.Empty(t, f.storage.listCalls)

	f.configs.Reload([]*app.ManifestData{folderManifest(1, app.ManifestVersionKindEmbedField{Name: "title", Path: "spec.title"})})
	f.run(t, backfillIteration{upserts: 1, completedJobs: []int64{1}})
	assert.Equal(t, "folder_partition", vec.upserts[0][0].Resource)
	assert.Equal(t, "title: Operations", vec.upserts[0][0].Content)
	assert.Equal(t, 1, vec.upserts[0][0].ContentVersion)
	assert.Equal(t, []resource.NamespacedResource{{Group: "folder.grafana.app", Resource: "folders"}}, f.storage.listKeys)
	require.NotEmpty(t, vec.checkpoints)
	cursor, err := decodeCursor(vec.checkpoints[0].LastSeenKey)
	require.NoError(t, err)
	assert.Equal(t, "folder_partition", cursor.Resource)
	assert.Equal(t, "folder_partition", vec.reopenCalls[0].Resource)
	wantUnknown := oldUnknown
	wantUnknown.Folder = "new-parent"
	assert.Equal(t, wantUnknown, vec.rows[rowsKey("ns", "test-model", "folder_partition", "unknown")][""], "unsupported API versions retain their content and version but update the authorization folder")

	f.configs.Reload(nil)
	vec.jobs[0].IsComplete = false
	f.run(t, backfillIteration{})
	assert.Len(t, f.storage.listCalls, 1)
	assert.False(t, vec.jobs[0].IsComplete)

	f.configs.Reload([]*app.ManifestData{folderManifest(2, app.ManifestVersionKindEmbedField{Name: "description", Path: "spec.description"})})
	f.run(t, backfillIteration{upserts: 1, completedJobs: []int64{1}})
	assert.Equal(t, "folder_partition", vec.upserts[1][0].Resource)
	assert.Equal(t, "description: Production dashboards", vec.upserts[1][0].Content)
	assert.Equal(t, 2, vec.upserts[1][0].ContentVersion)
	assert.Equal(t, 2, vec.jobContentVersion[1])
	assert.True(t, vec.jobs[0].IsComplete)

	f.configs.Reload([]*app.ManifestData{folderManifest(3, app.ManifestVersionKindEmbedField{Name: "description", Path: "spec.description"})})
	f.run(t, backfillIteration{completedJobs: []int64{1}})
	require.Len(t, vec.updateCalls, 1)
	assert.Equal(t, "folder_partition", vec.updateCalls[0].Resource)
	assert.Equal(t, 3, vec.updateCalls[0].Version)

	f.configs.Reload([]*app.ManifestData{folderManifest(4)})
	f.run(t, backfillIteration{completedJobs: []int64{1}})
	require.Len(t, vec.deletes, 1)
	assert.Equal(t, "folder_partition", vec.deletes[0].Resource)
	assert.Equal(t, "known", vec.deletes[0].UID)
	assert.Equal(t, wantUnknown, vec.rows[rowsKey("ns", "test-model", "folder_partition", "unknown")][""])
}

func TestRunBackfillCollectionUnavailable(t *testing.T) {
	for _, tt := range []struct {
		name       string
		collection *vector.Collection
		resolveErr error
	}{
		{name: "not provisioned"},
		{name: "catalog error", resolveErr: errors.New("catalog unavailable")},
		{name: "external collection", collection: &vector.Collection{Group: "dashboard.grafana.app", Resource: "dashboards", PartitionKey: "dashboards_external", IsExternal: true}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			storage := newFakeStorage()
			vec := newFakeVector()
			vec.collections = make(map[string]vector.Collection)
			if tt.collection != nil {
				vec.collections["dashboard.grafana.app/dashboards"] = *tt.collection
			}
			vec.resolveErr = tt.resolveErr
			vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", StoppingRV: 100}}
			b := newBackfiller(t, storage, vec)
			b.runBackfill(context.Background())
			assert.Empty(t, storage.listCalls)
			assert.Empty(t, vec.completedJobIDs)
			assert.Empty(t, vec.reopenCalls)
		})
	}
}

func TestBackfillIdenticalContentUpdatesChangedFolder(t *testing.T) {
	f := setupEnrollmentBackfillTest(t, []string{"folder.grafana.app/folders"}, nil)
	f.configs.Reload([]*app.ManifestData{
		folderManifest(2, app.ManifestVersionKindEmbedField{Name: "title", Path: "spec.title"}),
	})
	f.seedFolders(listItem{Namespace: "ns", Name: "folder", RV: 50, Value: []byte(`{"apiVersion":"folder.grafana.app/v1","metadata":{"annotations":{"grafana.app/folder":"new-parent"}},"spec":{"title":"Operations"}}`)})
	f.storage.seedFolder("ns", "new-parent", "New parent")
	vec := f.vec
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", Resource: "folders", StoppingRV: 100}}
	vec.seedStoredContent("ns", "test-model", "folders", "folder", "", "title: Operations", 1)
	old := vec.rows[rowsKey("ns", "test-model", "folders", "folder")][""]
	old.Folder = "old-parent"
	old.Embedding = []float32{0.1, 0.2}
	vec.rows[rowsKey("ns", "test-model", "folders", "folder")][""] = old
	f.run(t, backfillIteration{completedJobs: []int64{1}})
	assert.Zero(t, f.text.calls)
	old.Folder = "new-parent"
	old.ContentVersion = 2
	assert.Equal(t, old, vec.rows[rowsKey("ns", "test-model", "folders", "folder")][""])
	require.Len(t, vec.updateCalls, 1)
}

func TestBackfillDefersJobNewerThanSnapshot(t *testing.T) {
	f := setupEnrollmentBackfillTest(t, []string{"folder.grafana.app/folders"}, nil)
	fields := []app.ManifestVersionKindEmbedField{{Name: "title", Path: "spec.title"}}
	f.configs.Reload([]*app.ManifestData{folderManifest(1, fields...)})
	f.seedFolders(listItem{Namespace: "ns", Name: "folder", RV: 50, Value: []byte(`{"apiVersion":"folder.grafana.app/v1","spec":{"title":"Operations"}}`)})
	vec := f.vec
	vec.onListJobs = func() {
		f.configs.Reload([]*app.ManifestData{folderManifest(2, fields...)})
		vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", Resource: "folders", StoppingRV: 100, ContentVersion: 2}}
		vec.onListJobs = nil
	}
	f.run(t, backfillIteration{})
	assert.Empty(t, f.storage.listCalls)
	f.run(t, backfillIteration{upserts: 1, completedJobs: []int64{1}})
	assert.Equal(t, 2, vec.upserts[0][0].ContentVersion)
}

func TestBackfillRemovedDeclarationLeavesOtherResourcesAvailable(t *testing.T) {
	f := setupEnrollmentBackfillTest(t, []string{"dashboard.grafana.app/dashboards", "folder.grafana.app/folders"}, []embed.Builder{dashboard.New()})
	f.configs.Reload([]*app.ManifestData{folderManifest(1)})
	vec := f.vec
	vec.jobs = []vector.BackfillJob{
		{ID: 1, Model: "test-model", Resource: "dashboards", StoppingRV: 100},
		{ID: 2, Model: "test-model", Resource: "folders", StoppingRV: 100},
	}
	f.configs.Reload(nil)
	f.run(t, backfillIteration{completedJobs: []int64{1}})
	assert.Equal(t, []resource.NamespacedResource{{Group: "dashboard.grafana.app", Resource: "dashboards"}}, f.storage.listKeys)
	assert.False(t, vec.jobs[1].IsComplete)
	f.configs.Reload([]*app.ManifestData{folderManifest(1)})
	f.run(t, backfillIteration{completedJobs: []int64{2}})
	assert.True(t, vec.jobs[1].IsComplete)
}
