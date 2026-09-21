package reconciler

import (
	"encoding/json"
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	foldermanifest "github.com/grafana/grafana/apps/folder/pkg/apis/manifestdata"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/embedder"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed/enrollment"
	"github.com/grafana/grafana/pkg/storage/unified/search/vector"
)

var folderGR = schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}

func folderEvent(t *testing.T, name, version, title, description, parent string, rv int64) *pendingEvent {
	t.Helper()
	value, err := json.Marshal(map[string]any{
		"apiVersion": folderGR.Group + "/" + version,
		"metadata":   map[string]any{"annotations": map[string]string{"grafana.app/folder": parent}},
		"spec":       map[string]any{"title": title, "description": description},
	})
	require.NoError(t, err)
	return &pendingEvent{
		action: resourcepb.WatchEvent_MODIFIED,
		group:  folderGR.Group, resource: folderGR.Resource,
		namespace: "ns", name: name, rv: snowflakeRV(rv), value: value,
	}
}

func newRuntimeReconciler(t *testing.T, st *fakeStorage, vec *fakeVector, provider embed.BuilderProvider) *Reconciler {
	t.Helper()
	s, err := New(Options{
		Storage: st, VectorBackend: vec,
		BatchEmbedder:   embedder.NewBatchEmbedder(*newFakeEmbedder(&fakeText{dim: 4})),
		BuilderProvider: provider,
	})
	require.NoError(t, err)
	return s
}

func TestReconciler_RuntimeFolderEnrollment(t *testing.T) {
	configs := resource.NewEmbeddingConfigRegistry()
	metrics := resource.ProvideVectorMetrics(prometheus.NewRegistry())
	provider, err := enrollment.New(configs, []string{folderGR.Group + "/" + folderGR.Resource}, nil, metrics.EmbedSkippedVersionsTotal)
	require.NoError(t, err)
	vec := newFakeVector()
	const partition = "folder_documents"
	vec.collections = map[schema.GroupResource]vector.Collection{
		folderGR: {Group: folderGR.Group, Resource: folderGR.Resource, PartitionKey: partition},
	}
	s := newRuntimeReconciler(t, &fakeStorage{}, vec, provider)

	// Construction precedes the initial live manifest load.
	s.enqueue(folderEvent(t, "folder", "v1", "Before loading", "", "", 100))
	s.reconcileCycle(t.Context())
	assert.Zero(t, s.pendingLen())
	assert.Empty(t, vec.ensuredCollections)
	assert.Zero(t, vec.setLatestRVCalls)

	manifest := foldermanifest.LocalManifest().ManifestData
	configs.Reload([]*app.ManifestData{manifest})
	require.NoError(t, provider.Validate())
	assert.Empty(t, vec.ensuredCollections, "loading declarations alone does not initialize a collection")
	s.enqueue(folderEvent(t, "folder", "v1", "Operations", "Service dashboards", "", 200))
	s.processPending(t.Context())

	require.Len(t, vec.upserts, 1)
	assert.Equal(t, partition, vec.upserts[0][0].Resource)
	assert.Equal(t, "title: Operations\ndescription: Service dashboards", vec.upserts[0][0].Content)
	assert.Equal(t, 1, vec.upserts[0][0].ContentVersion)
	assert.Equal(t, []schema.GroupResource{folderGR}, vec.ensuredCollections)
	require.Len(t, vec.backfillJobs, 1)
	assert.Equal(t, partition, vec.backfillJobs[0].Resource)
	assert.Equal(t, snowflakeRV(200), vec.backfillJobs[0].StoppingRV)
	assert.Equal(t, 1, vec.backfillJobs[0].ContentVersion)

	s.enqueue(folderEvent(t, "folder", "v1beta1", "Operations", "Service dashboards", "", 210))
	s.processPending(t.Context())
	assert.Len(t, vec.upserts, 1, "content lookup uses the catalog partition, so unchanged text is not re-embedded")

	s.enqueue(folderEvent(t, "folder", "v1", "Queued before removal", "", "", 220))
	configs.Reload()
	checkpoint := vec.latestRV
	checkpointWrites := vec.setLatestRVCalls
	s.reconcileCycle(t.Context())
	s.enqueue(folderEvent(t, "folder", "v1", "While removed", "", "", 230))
	assert.Zero(t, s.pendingLen())
	assert.Equal(t, checkpoint, vec.latestRV)
	assert.Equal(t, checkpointWrites, vec.setLatestRVCalls, "empty enrollment must not advance the checkpoint")
	assert.Len(t, vec.upserts, 1)
	assert.Empty(t, vec.deletes)

	configs.Reload([]*app.ManifestData{manifest})
	s.enqueue(folderEvent(t, "folder", "v1beta1", "Restored", "New description", "", 240))
	s.processPending(t.Context())
	require.Len(t, vec.upserts, 2)
	assert.Equal(t, "title: Restored\ndescription: New description", vec.upserts[1][0].Content)
	assert.Len(t, vec.backfillJobs, 1, "restoring a declaration reuses its provisioned collection")

	s.enqueue(folderEvent(t, "folder", "v2", "Unknown version", "", "parent", 250))
	s.processPending(t.Context())
	assert.Len(t, vec.upserts, 2)
	assert.Empty(t, vec.deletes)
	assert.Equal(t, "parent", vec.storedFolder[subsKey("ns", testModel, partition, "folder")])
	assert.Equal(t, float64(1), testutil.ToFloat64(metrics.EmbedSkippedVersionsTotal.WithLabelValues(folderGR.Group, folderGR.Resource, "v2")))

	deleted := folderEvent(t, "folder", "v1", "", "", "", 260)
	deleted.action = resourcepb.WatchEvent_DELETED
	s.enqueue(deleted)
	s.processPending(t.Context())
	assert.Equal(t, []deleteCall{{"ns", testModel, partition, "folder"}}, vec.deletes)
	assert.Empty(t, vec.storedContentFor("ns", partition, "folder"))
}

func TestReconciler_SweepKeepsManifestSnapshotAcrossBatches(t *testing.T) {
	oldBatchSize := startupBatchSize
	startupBatchSize = 1
	t.Cleanup(func() { startupBatchSize = oldBatchSize })

	manifest := foldermanifest.LocalManifest().ManifestData
	configs := resource.NewEmbeddingConfigRegistry([]*app.ManifestData{manifest})
	provider, err := enrollment.New(configs, []string{folderGR.Group + "/" + folderGR.Resource}, nil, nil)
	require.NoError(t, err)
	first := folderEvent(t, "first", "v1", "First title", "First description", "", 100)
	second := folderEvent(t, "second", "v1beta1", "Second title", "Second description", "", 200)
	st := &fakeStorage{changes: []*resource.ModifiedResource{
		change(folderGR.Group, folderGR.Resource, "ns", first.name, first.rv, first.value),
		change(folderGR.Group, folderGR.Resource, "ns", second.name, second.rv, second.value),
	}}
	vec := newFakeVector()
	vec.latestRV = snowflakeRV(50)
	vec.onUpsert = func() {
		configs.Reload([]*app.ManifestData{{
			Group: folderGR.Group,
			Embed: map[string]app.ManifestResourceEmbed{folderGR.Resource: {ReembedVersion: 2}},
			Versions: []app.ManifestVersion{{
				Name: "v1beta1",
				Kinds: []app.ManifestVersionKind{{
					Kind: "Folder", Plural: folderGR.Resource,
					Embed: &app.ManifestVersionKindEmbed{Fields: []app.ManifestVersionKindEmbedField{{Name: "description", Path: "spec.description"}}},
				}},
			}},
		}})
	}
	s := newRuntimeReconciler(t, st, vec, provider)
	s.sweep(t.Context())

	require.Len(t, vec.upserts, 2)
	for _, batch := range vec.upserts {
		assert.Equal(t, 1, batch[0].ContentVersion)
	}
	assert.Equal(t, "title: Second title\ndescription: Second description", vec.upserts[1][0].Content)
	assert.Equal(t, snowflakeRV(200), vec.latestRV)

	s.enqueue(folderEvent(t, "second", "v1beta1", "Second title", "Updated description", "", 300))
	s.processPending(t.Context())
	require.Len(t, vec.upserts, 3)
	assert.Equal(t, 2, vec.upserts[2][0].ContentVersion)
	assert.Equal(t, "description: Updated description", vec.upserts[2][0].Content)
}

func TestReconciler_CollectionCacheUsesGroupAndResource(t *testing.T) {
	vec := newFakeVector()
	first := fakeBuilder{group: "first.example.test", resource: "documents"}
	second := fakeBuilder{group: "second.example.test", resource: "documents"}
	vec.collections = map[schema.GroupResource]vector.Collection{
		{Group: first.Group(), Resource: first.Resource()}:   {PartitionKey: "first_documents"},
		{Group: second.Group(), Resource: second.Resource()}: {PartitionKey: "second_documents"},
	}
	s := newReconcilerWithBuilders(t, &fakeStorage{}, vec, first, second)
	for i, builder := range []embed.Builder{first, second} {
		s.enqueue(&pendingEvent{
			action: resourcepb.WatchEvent_ADDED, group: builder.Group(), resource: builder.Resource(),
			namespace: "ns", name: "document", rv: snowflakeRV(int64(i + 100)), value: []byte(`{"spec":{}}`),
		})
	}
	s.processPending(t.Context())
	assert.ElementsMatch(t, []string{"first_documents", "second_documents"}, vec.ensuredPartitions)
	assert.True(t, vec.hasUpsertFor("ns", "first_documents", "document"))
	assert.True(t, vec.hasUpsertFor("ns", "second_documents", "document"))
}

func TestReconciler_NewlyEnrolledResourceKeepsSweepLookback(t *testing.T) {
	configs := resource.NewEmbeddingConfigRegistry()
	provider, err := enrollment.New(configs, []string{dashGroup + "/" + dashRes, folderGR.Group + "/" + folderGR.Resource}, []embed.Builder{fakeBuilder{group: dashGroup, resource: dashRes}}, nil)
	require.NoError(t, err)
	folder := folderEvent(t, "folder", "v1", "Recently written", "", "", 95)
	st := &fakeStorage{
		changes:          []*resource.ModifiedResource{change(folder.group, folder.resource, folder.namespace, folder.name, folder.rv, folder.value)},
		lookback:         10,
		latestRvOverride: snowflakeRV(100),
	}
	vec := newFakeVector()
	vec.latestRV = snowflakeRV(100)
	s := newRuntimeReconciler(t, st, vec, provider)
	s.sweep(t.Context())

	configs.Reload([]*app.ManifestData{foldermanifest.LocalManifest().ManifestData})
	s.sweep(t.Context())

	require.Len(t, st.lastCalledWith, 3)
	assert.NotNil(t, st.lastCalledWith[1], "the existing dashboard builder already covered this lookback")
	assert.Nil(t, st.lastCalledWith[2], "the newly enrolled folder builder still needs the lookback")
	assert.True(t, vec.hasUpsertFor("ns", folderGR.Resource, "folder"))
}
