package migrator

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"

	dashV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/secrets"
	secretsfakes "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

type fakeBulkStream struct {
	grpc.ClientStream
	sent      []*resourcepb.BulkRequest
	sendErr   error
	failAfter int
}

func (f *fakeBulkStream) Send(req *resourcepb.BulkRequest) error {
	if f.sendErr != nil && len(f.sent) == f.failAfter {
		return f.sendErr
	}
	f.sent = append(f.sent, req)
	return nil
}

func (f *fakeBulkStream) Header() (metadata.MD, error) {
	return metadata.Pairs(resourcepb.InlineBlobMetadataKey, "1"), nil
}

func (f *fakeBulkStream) CloseAndRecv() (*resourcepb.BulkResponse, error) {
	return &resourcepb.BulkResponse{}, nil
}

type decryptErrSecrets struct{ secrets.Service }

func (decryptErrSecrets) Decrypt(context.Context, []byte) ([]byte, error) {
	return nil, errors.New("decrypt failed")
}

type invalidJSONSecrets struct{ secrets.Service }

func (invalidJSONSecrets) Decrypt(context.Context, []byte) ([]byte, error) {
	return []byte("not-json"), nil
}

func insertSnapshot(t *testing.T, store db.DB, snap *dashboardsnapshots.DashboardSnapshot) {
	t.Helper()
	// delete_key has a UNIQUE constraint; default it to Key so callers don't have to.
	if snap.DeleteKey == "" {
		snap.DeleteKey = snap.Key
	}
	err := store.WithDbSession(context.Background(), func(sess *db.Session) error {
		_, err := sess.Insert(snap)
		return err
	})
	require.NoError(t, err)
}

func newTestMigrator(sec secrets.Service, store db.DB) *snapshotMigrator { //nolint:staticcheck // SA1019: Legacy envelope encryption for single-tenant feature
	return &snapshotMigrator{sql: legacysql.NewDatabaseProvider(store), decrypt: sec.Decrypt}
}

type unsupportedBulkStream struct{ fakeBulkStream }

func (*unsupportedBulkStream) Header() (metadata.MD, error) { return nil, nil }

func TestSnapshotMigrationRequiresAcknowledgement(t *testing.T) {
	stream := &unsupportedBulkStream{}
	m := &snapshotMigrator{}
	err := m.MigrateSnapshots(t.Context(), 1, migrations.MigrateOptions{}, stream)
	require.Error(t, err)
	require.Empty(t, stream.sent)
}

func TestSnapshotUpload(t *testing.T) {
	for _, size := range []int{1, resourcepb.BulkBlobChunkSize, resourcepb.BulkBlobChunkSize + 1, 3 * resourcepb.BulkBlobChunkSize} {
		t.Run(fmt.Sprint(size), func(t *testing.T) {
			body := bytes.Repeat([]byte("x"), size)
			upload := snapshotUpload{request: &resourcepb.BulkRequest{Value: []byte(`{}`)}, dashboard: body}
			stream := &fakeBulkStream{}
			require.NoError(t, upload.send(stream))
			require.Same(t, upload.request, stream.sent[0])
			var received []byte
			for _, frame := range stream.sent[1 : len(stream.sent)-1] {
				require.NoError(t, resourcepb.ValidateBulkBlobFrame(frame))
				require.False(t, frame.BlobChunk.Last)
				received = append(received, frame.BlobChunk.Value...)
			}
			require.Equal(t, body, received)
			require.Equal(t, &resourcepb.BulkBlobChunk{Name: "dashboard", Last: true}, stream.sent[len(stream.sent)-1].BlobChunk)
		})
	}
}

func TestSnapshotUploadStopsOnSendFailure(t *testing.T) {
	upload := snapshotUpload{
		request:   &resourcepb.BulkRequest{Value: []byte(`{}`)},
		dashboard: bytes.Repeat([]byte("x"), resourcepb.BulkBlobChunkSize+1),
	}
	for failAfter := range 4 {
		stream := &fakeBulkStream{sendErr: errors.New("send failed"), failAfter: failAfter}
		require.ErrorIs(t, upload.send(stream), stream.sendErr)
		require.Len(t, stream.sent, failAfter)
	}
}

func TestIntegrationMigrateSnapshots(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	opts := migrations.MigrateOptions{
		Namespace: "default",
		Progress:  func(int, string) {},
	}
	now := time.Now().UTC().Truncate(time.Second)
	future := now.Add(time.Hour)

	t.Run("external snapshot is migrated without touching the secrets service", func(t *testing.T) {
		store := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
		m := newTestMigrator(secretsfakes.NewFakeSecretsService(), store)
		insertSnapshot(t, store, &dashboardsnapshots.DashboardSnapshot{
			OrgID: 1, Name: "ext", Key: "ext-key", DeleteKey: "ext-del", UserID: 42,
			External: true, ExternalURL: "https://example.com/share/ext-key", ExternalDeleteURL: "https://delete.example.com/private/ext-del?token=original",
			Expires: future, Created: now, Updated: now,
		})

		stream := &fakeBulkStream{}
		require.NoError(t, m.MigrateSnapshots(ctx, 1, opts, stream))
		require.Len(t, stream.sent, 1)

		var snap dashV0.Snapshot
		require.NoError(t, json.Unmarshal(stream.sent[0].Value, &snap))
		require.Equal(t, "ext-key", snap.Name)
		require.NotNil(t, snap.Spec.External)
		require.True(t, *snap.Spec.External)
		require.NotNil(t, snap.Spec.ExternalUrl)
		require.Equal(t, "https://example.com/share/ext-key", *snap.Spec.ExternalUrl)
		require.Equal(t, "https://delete.example.com/private/ext-del?token=original", snap.GetExternalDeleteURL())
		require.Nil(t, snap.Blobs.Dashboard)
		require.NotNil(t, snap.Spec.DeleteKey)
		require.Equal(t, "ext-del", *snap.Spec.DeleteKey)
	})

	t.Run("internal snapshot sends the decrypted body as raw blob frames", func(t *testing.T) {
		store := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
		m := newTestMigrator(secretsfakes.NewFakeSecretsService(), store)
		body := []byte(" {\"title\":\"internal\",\"largeNumber\":9007199254740993}\n")
		insertSnapshot(t, store, &dashboardsnapshots.DashboardSnapshot{
			OrgID: 1, Name: "int", Key: "int-key", DeleteKey: "private-delete", UserID: 42,
			DashboardEncrypted: body, // FakeSecretsService.Decrypt is a pass-through
			Expires:            future, Created: now, Updated: now.Add(time.Second),
		})

		stream := &fakeBulkStream{}
		require.NoError(t, m.MigrateSnapshots(ctx, 1, opts, stream))
		require.Len(t, stream.sent, 3)

		var snap dashV0.Snapshot
		require.NoError(t, json.Unmarshal(stream.sent[0].Value, &snap))
		require.Nil(t, snap.Blobs.Dashboard)
		require.Equal(t, "private-delete", *snap.Spec.DeleteKey)
		require.Equal(t, "int-key", snap.Name)
		require.Equal(t, "default", snap.Namespace)
		require.Equal(t, future.UnixMilli(), *snap.Spec.Expires)
		require.Equal(t, "user:42", snap.GetCreatedBy())
		meta, err := utils.MetaAccessor(&snap)
		require.NoError(t, err)
		updated, err := meta.GetUpdatedTimestamp()
		require.NoError(t, err)
		require.NotNil(t, updated)
		require.Equal(t, now.Add(time.Second).UnixMilli(), updated.UnixMilli())
		require.Equal(t, []*resourcepb.BulkBlobUpload{{Name: "dashboard", ContentType: "application/json", Size: int64(len(body))}}, stream.sent[0].BlobUploads)
		require.Equal(t, body, stream.sent[1].BlobChunk.Value)
		require.True(t, stream.sent[2].BlobChunk.Last)
		for _, frame := range stream.sent {
			require.NoError(t, resourcepb.ValidateBulkBlobFrame(frame))
		}
	})

	t.Run("decrypt failure halts the migration", func(t *testing.T) {
		store := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
		m := newTestMigrator(decryptErrSecrets{secretsfakes.NewFakeSecretsService()}, store)
		insertSnapshot(t, store, &dashboardsnapshots.DashboardSnapshot{
			OrgID: 1, Name: "bad", Key: "bad-key",
			DashboardEncrypted: []byte("anything"),
			Expires:            future, Created: now, Updated: now,
		})

		err := m.MigrateSnapshots(ctx, 1, opts, &fakeBulkStream{})
		require.Error(t, err)
		require.Contains(t, err.Error(), "bad-key")
	})

	t.Run("invalid decrypted JSON halts the migration", func(t *testing.T) {
		store := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
		m := newTestMigrator(invalidJSONSecrets{secretsfakes.NewFakeSecretsService()}, store)
		insertSnapshot(t, store, &dashboardsnapshots.DashboardSnapshot{
			OrgID: 1, Name: "bad-json", Key: "bad-json-key",
			DashboardEncrypted: []byte("ignored"),
			Expires:            future, Created: now, Updated: now,
		})

		err := m.MigrateSnapshots(ctx, 1, opts, &fakeBulkStream{})
		require.Error(t, err)
		require.Contains(t, err.Error(), "bad-json-key")
	})

	for _, plain := range []string{"", "null", "[]", `"string"`, "42"} {
		t.Run("reject invalid local dashboard "+plain, func(t *testing.T) {
			store := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup
			m := newTestMigrator(secretsfakes.NewFakeSecretsService(), store)
			insertSnapshot(t, store, &dashboardsnapshots.DashboardSnapshot{
				OrgID: 1, Key: "invalid-local", DashboardEncrypted: []byte(plain), Expires: future, Created: now, Updated: now,
			})
			stream := &fakeBulkStream{}
			err := m.MigrateSnapshots(ctx, 1, opts, stream)
			require.ErrorContains(t, err, "invalid-local")
			require.Empty(t, stream.sent)
		})
	}

	t.Run("expiry dates before 2070 are preserved; 2070+ are dropped", func(t *testing.T) {
		store := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
		m := newTestMigrator(secretsfakes.NewFakeSecretsService(), store)
		before := time.Date(2069, time.December, 31, 23, 59, 59, 0, time.UTC)
		at := time.Date(2070, time.January, 1, 0, 0, 0, 0, time.UTC)

		insertSnapshot(t, store, &dashboardsnapshots.DashboardSnapshot{
			OrgID: 1, Name: "before", Key: "before-key",
			External: true, ExternalURL: "x",
			Expires: before, Created: now, Updated: now,
		})
		insertSnapshot(t, store, &dashboardsnapshots.DashboardSnapshot{
			OrgID: 1, Name: "at", Key: "at-key",
			External: true, ExternalURL: "x",
			Expires: at, Created: now, Updated: now,
		})

		stream := &fakeBulkStream{}
		require.NoError(t, m.MigrateSnapshots(ctx, 1, opts, stream))
		require.Len(t, stream.sent, 2)

		byKey := map[string]dashV0.Snapshot{}
		for _, r := range stream.sent {
			var s dashV0.Snapshot
			require.NoError(t, json.Unmarshal(r.Value, &s))
			byKey[s.Name] = s
		}
		require.NotNil(t, byKey["before-key"].Spec.Expires)
		require.Equal(t, before.UnixMilli(), *byKey["before-key"].Spec.Expires)
		require.Nil(t, byKey["at-key"].Spec.Expires, "expires at/after Jan 1 2070 must be dropped")
	})

	t.Run("pagination sends every row when total exceeds the batch limit", func(t *testing.T) {
		store := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
		m := newTestMigrator(secretsfakes.NewFakeSecretsService(), store)
		const total = 150 // batch limit in MigrateSnapshots is 100
		for i := range total {
			insertSnapshot(t, store, &dashboardsnapshots.DashboardSnapshot{
				OrgID: 1, Name: fmt.Sprintf("n%d", i), Key: fmt.Sprintf("k%d", i),
				External: true, ExternalURL: "x",
				Expires: future, Created: now, Updated: now,
			})
		}

		stream := &fakeBulkStream{}
		require.NoError(t, m.MigrateSnapshots(ctx, 1, opts, stream))
		require.Len(t, stream.sent, total)
	})

	t.Run("only the requested org is migrated", func(t *testing.T) {
		store := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
		m := newTestMigrator(secretsfakes.NewFakeSecretsService(), store)
		insertSnapshot(t, store, &dashboardsnapshots.DashboardSnapshot{
			OrgID: 1, Name: "in", Key: "in-key", External: true, ExternalURL: "x",
			Expires: future, Created: now, Updated: now,
		})
		insertSnapshot(t, store, &dashboardsnapshots.DashboardSnapshot{
			OrgID: 2, Name: "out", Key: "out-key", External: true, ExternalURL: "x",
			Expires: future, Created: now, Updated: now,
		})

		stream := &fakeBulkStream{}
		require.NoError(t, m.MigrateSnapshots(ctx, 1, opts, stream))
		require.Len(t, stream.sent, 1)
		require.Equal(t, "in-key", stream.sent[0].Key.Name)
	})
}
