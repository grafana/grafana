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

func TestRuntimeEnrollmentAndCatalogPartition(t *testing.T) {
	ctx := context.Background()
	configs := resource.NewEmbeddingConfigRegistry(nil)
	registry, err := enrollment.New(configs, []string{"folder.grafana.app/folders"}, nil, nil)
	require.NoError(t, err)
	provider := &countingProvider{BuilderProvider: registry}

	storage := newFakeStorage()
	storage.listItems = []listItem{
		{Namespace: "ns", Name: "known", RV: 50, Value: []byte(`{"apiVersion":"folder.grafana.app/v1","spec":{"title":"Operations","description":"Production dashboards"}}`)},
		{Namespace: "ns", Name: "unknown", RV: 60, Value: []byte(`{"apiVersion":"folder.grafana.app/v2","metadata":{"annotations":{"grafana.app/folder":"new-parent"}}}`)},
	}
	for _, item := range storage.listItems {
		storage.resources[storeKey(item.Namespace, "folder.grafana.app", "folders", item.Name)] = storedResource{Value: item.Value, RV: item.RV}
	}
	storage.seedFolder("ns", "new-parent", "New parent")
	vec := newFakeVector()
	vec.collections = map[string]vector.Collection{
		"folder.grafana.app/folders": {Group: "folder.grafana.app", Resource: "folders", PartitionKey: "folder_partition"},
	}
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", Resource: "folder_partition", StoppingRV: 100}}
	vec.latestRV = 100
	vec.seedStoredContent("ns", "test-model", "folder_partition", "unknown", "", "Previously embedded", 0)
	oldUnknown := vec.rows[rowsKey("ns", "test-model", "folder_partition", "unknown")][""]
	oldUnknown.Folder = "old-parent"
	vec.rows[rowsKey("ns", "test-model", "folder_partition", "unknown")][""] = oldUnknown

	text := &fakeText{dim: 4}
	b, err := NewVectorBackfiller(Options{
		Storage: storage, VectorBackend: vec, BatchEmbedder: embedder.NewBatchEmbedder(*newFakeEmbedder(text)), BuilderProvider: provider,
	})
	require.NoError(t, err)
	assert.Zero(t, provider.snapshots, "live manifests need not be available during construction")
	b.runBackfill(ctx)
	assert.Empty(t, storage.listCalls)
	assert.Empty(t, vec.completedJobIDs, "an empty enrollment must leave pending jobs available")

	configs.Reload([]*app.ManifestData{folderManifest(1, app.ManifestVersionKindEmbedField{Name: "title", Path: "spec.title"})})
	b.runBackfill(ctx)
	require.Len(t, vec.upserts, 1)
	assert.Equal(t, "folder_partition", vec.upserts[0][0].Resource)
	assert.Equal(t, "title: Operations", vec.upserts[0][0].Content)
	assert.Equal(t, 1, vec.upserts[0][0].ContentVersion)
	assert.Equal(t, []resource.NamespacedResource{{Group: "folder.grafana.app", Resource: "folders"}}, storage.listKeys)
	require.NotEmpty(t, vec.checkpoints)
	cursor, err := decodeCursor(vec.checkpoints[0].LastSeenKey)
	require.NoError(t, err)
	assert.Equal(t, "folder_partition", cursor.Resource)
	assert.Equal(t, "folder_partition", vec.reopenCalls[0].Resource)
	assert.Equal(t, []int64{1}, vec.completedJobIDs)
	wantUnknown := oldUnknown
	wantUnknown.Folder = "new-parent"
	assert.Equal(t, wantUnknown, vec.rows[rowsKey("ns", "test-model", "folder_partition", "unknown")][""], "unsupported API versions retain their content and version but update the authorization folder")

	configs.Reload(nil)
	vec.jobs[0].IsComplete = false
	b.runBackfill(ctx)
	assert.Len(t, vec.upserts, 1)
	assert.Len(t, storage.listCalls, 1)
	assert.Len(t, vec.completedJobIDs, 1, "removed resources leave their job incomplete and vectors intact")
	assert.False(t, vec.jobs[0].IsComplete)

	configs.Reload([]*app.ManifestData{folderManifest(2, app.ManifestVersionKindEmbedField{Name: "description", Path: "spec.description"})})
	b.runBackfill(ctx)
	require.Len(t, vec.upserts, 2)
	assert.Equal(t, "folder_partition", vec.upserts[1][0].Resource)
	assert.Equal(t, "description: Production dashboards", vec.upserts[1][0].Content)
	assert.Equal(t, 2, vec.upserts[1][0].ContentVersion)
	assert.Equal(t, 2, vec.jobContentVersion[1])
	assert.True(t, vec.jobs[0].IsComplete)

	configs.Reload([]*app.ManifestData{folderManifest(3, app.ManifestVersionKindEmbedField{Name: "description", Path: "spec.description"})})
	b.runBackfill(ctx)
	assert.Len(t, vec.upserts, 2, "unchanged text only needs its version advanced")
	require.Len(t, vec.updateCalls, 1)
	assert.Equal(t, "folder_partition", vec.updateCalls[0].Resource)
	assert.Equal(t, 3, vec.updateCalls[0].Version)

	configs.Reload([]*app.ManifestData{folderManifest(4)})
	b.runBackfill(ctx)
	require.Len(t, vec.deletes, 1)
	assert.Equal(t, "folder_partition", vec.deletes[0].Resource)
	assert.Equal(t, "known", vec.deletes[0].UID)
	assert.Equal(t, wantUnknown, vec.rows[rowsKey("ns", "test-model", "folder_partition", "unknown")][""])
	assert.Equal(t, 6, provider.snapshots, "one immutable declaration snapshot per backfill run")
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
	configs := resource.NewEmbeddingConfigRegistry([]*app.ManifestData{
		folderManifest(2, app.ManifestVersionKindEmbedField{Name: "title", Path: "spec.title"}),
	})
	registry, err := enrollment.New(configs, []string{"folder.grafana.app/folders"}, nil, nil)
	require.NoError(t, err)
	storage := newFakeStorage()
	item := listItem{Namespace: "ns", Name: "folder", RV: 50, Value: []byte(`{"apiVersion":"folder.grafana.app/v1","metadata":{"annotations":{"grafana.app/folder":"new-parent"}},"spec":{"title":"Operations"}}`)}
	storage.listItems = []listItem{item}
	storage.resources[storeKey("ns", "folder.grafana.app", "folders", "folder")] = storedResource{Value: item.Value, RV: item.RV}
	storage.seedFolder("ns", "new-parent", "New parent")
	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", Resource: "folders", StoppingRV: 100}}
	vec.seedStoredContent("ns", "test-model", "folders", "folder", "", "title: Operations", 1)
	old := vec.rows[rowsKey("ns", "test-model", "folders", "folder")][""]
	old.Folder = "old-parent"
	vec.rows[rowsKey("ns", "test-model", "folders", "folder")][""] = old
	b, err := NewVectorBackfiller(Options{
		Storage: storage, VectorBackend: vec, BatchEmbedder: embedder.NewBatchEmbedder(*newFakeEmbedder(&fakeText{dim: 4})), BuilderProvider: registry,
	})
	require.NoError(t, err)
	b.runBackfill(context.Background())
	require.Len(t, vec.upserts, 1)
	assert.Equal(t, "new-parent", vec.upserts[0][0].Folder)
	assert.Equal(t, 2, vec.upserts[0][0].ContentVersion)
	assert.Empty(t, vec.updateCalls, "a version-only update would preserve the old authorization folder")
	assert.Equal(t, []int64{1}, vec.completedJobIDs)
}

func TestBackfillDefersJobNewerThanSnapshot(t *testing.T) {
	fields := []app.ManifestVersionKindEmbedField{{Name: "title", Path: "spec.title"}}
	configs := resource.NewEmbeddingConfigRegistry([]*app.ManifestData{folderManifest(1, fields...)})
	registry, err := enrollment.New(configs, []string{"folder.grafana.app/folders"}, nil, nil)
	require.NoError(t, err)
	storage := newFakeStorage()
	item := listItem{Namespace: "ns", Name: "folder", RV: 50, Value: []byte(`{"apiVersion":"folder.grafana.app/v1","spec":{"title":"Operations"}}`)}
	storage.listItems = []listItem{item}
	storage.resources[storeKey("ns", "folder.grafana.app", "folders", "folder")] = storedResource{Value: item.Value, RV: item.RV}
	vec := newFakeVector()
	vec.onListJobs = func() {
		configs.Reload([]*app.ManifestData{folderManifest(2, fields...)})
		vec.jobs = []vector.BackfillJob{{ID: 1, Model: "test-model", Resource: "folders", StoppingRV: 100, ContentVersion: 2}}
		vec.onListJobs = nil
	}
	b, err := NewVectorBackfiller(Options{
		Storage: storage, VectorBackend: vec, BatchEmbedder: embedder.NewBatchEmbedder(*newFakeEmbedder(&fakeText{dim: 4})), BuilderProvider: registry,
	})
	require.NoError(t, err)
	b.runBackfill(context.Background())
	assert.Empty(t, storage.listCalls)
	assert.Empty(t, vec.upserts)
	assert.Empty(t, vec.completedJobIDs, "an old snapshot must not complete a new-revision job")
	b.runBackfill(context.Background())
	require.Len(t, vec.upserts, 1)
	assert.Equal(t, 2, vec.upserts[0][0].ContentVersion)
	assert.Equal(t, []int64{1}, vec.completedJobIDs)
}

func TestBackfillRemovedDeclarationLeavesOtherResourcesAvailable(t *testing.T) {
	configs := resource.NewEmbeddingConfigRegistry([]*app.ManifestData{folderManifest(1)})
	registry, err := enrollment.New(configs, []string{"dashboard.grafana.app/dashboards", "folder.grafana.app/folders"}, []embed.Builder{dashboard.New()}, nil)
	require.NoError(t, err)
	vec := newFakeVector()
	vec.jobs = []vector.BackfillJob{
		{ID: 1, Model: "test-model", Resource: "dashboards", StoppingRV: 100},
		{ID: 2, Model: "test-model", Resource: "folders", StoppingRV: 100},
	}
	storage := newFakeStorage()
	b, err := NewVectorBackfiller(Options{
		Storage: storage, VectorBackend: vec, BatchEmbedder: embedder.NewBatchEmbedder(*newFakeEmbedder(&fakeText{dim: 4})), BuilderProvider: registry,
	})
	require.NoError(t, err)
	configs.Reload(nil)
	b.runBackfill(context.Background())
	assert.Equal(t, []int64{1}, vec.completedJobIDs)
	assert.Equal(t, []resource.NamespacedResource{{Group: "dashboard.grafana.app", Resource: "dashboards"}}, storage.listKeys)
	assert.False(t, vec.jobs[1].IsComplete)
	configs.Reload([]*app.ManifestData{folderManifest(1)})
	b.runBackfill(context.Background())
	assert.Equal(t, []int64{1, 2}, vec.completedJobIDs)
	assert.True(t, vec.jobs[1].IsComplete)
}
