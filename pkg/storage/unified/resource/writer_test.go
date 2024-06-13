package resource

import (
	"context"
	"embed"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestWriter(t *testing.T) {
	tracer := noop.NewTracerProvider().Tracer("testing")
	testUserA := &identity.StaticRequester{
		Namespace:      identity.NamespaceUser,
		UserID:         123,
		UserUID:        "u123",
		OrgRole:        identity.RoleAdmin,
		IsGrafanaAdmin: true, // can do anything
	}
	ctx := identity.WithRequester(context.Background(), testUserA)

	store := NewMemoryStore()
	writer, err := NewResourceWriter(WriterOptions{
		Tracer:   tracer,
		Reader:   store.Read,
		Appender: store.WriteEvent,
	})
	require.NoError(t, err)

	t.Run("playlist happy CRUD paths", func(t *testing.T) {
		raw := testdata(t, "01_create_playlist.json")
		key := &ResourceKey{
			Group:     "playlist.grafana.app",
			Resource:  "rrrr", // can be anything :(
			Namespace: "default",
			Name:      "fdgsv37qslr0ga",
		}
		created, err := writer.Create(ctx, &CreateRequest{
			Value: raw,
			Key:   key,
		})
		require.NoError(t, err)
		require.True(t, created.ResourceVersion > 0)

		// The key does not include resource version
		found, err := store.Read(ctx, &ReadRequest{Key: key})
		require.NoError(t, err)
		require.Equal(t, created.ResourceVersion, found.ResourceVersion)

		// Now update the value
		tmp := &unstructured.Unstructured{}
		err = json.Unmarshal(raw, tmp)
		require.NoError(t, err)

		now := time.Now().UnixMilli()
		obj, err := utils.MetaAccessor(tmp)
		require.NoError(t, err)
		obj.SetAnnotation("test", "hello")
		obj.SetUpdatedTimestampMillis(now)
		obj.SetUpdatedBy(testUserA.GetUID().String())
		raw, err = json.Marshal(tmp)
		require.NoError(t, err)

		key.ResourceVersion = created.ResourceVersion
		updated, err := writer.Update(ctx, &UpdateRequest{Key: key, Value: raw})
		require.NoError(t, err)
		require.True(t, updated.ResourceVersion > created.ResourceVersion)

		// We should still get the latest
		key.ResourceVersion = 0
		found, err = store.Read(ctx, &ReadRequest{Key: key})
		require.NoError(t, err)
		require.Equal(t, updated.ResourceVersion, found.ResourceVersion)

		key.ResourceVersion = updated.ResourceVersion
		deleted, err := writer.Delete(ctx, &DeleteRequest{Key: key})
		require.NoError(t, err)
		require.True(t, deleted.ResourceVersion > updated.ResourceVersion)

		// We should get not found when trying to read the latest value
		key.ResourceVersion = 0
		found, _ = store.Read(ctx, &ReadRequest{Key: key})
		require.Equal(t, int32(404), found.Status.Code)
		require.Nil(t, found.Value)
	})
}

//go:embed testdata/*
var testdataFS embed.FS

func testdata(t *testing.T, filename string) []byte {
	t.Helper()
	b, err := testdataFS.ReadFile(`testdata/` + filename)
	require.NoError(t, err)
	return b
}
