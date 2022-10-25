package object_server_tests

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"reflect"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/grn"
	"github.com/grafana/grafana/pkg/services/store/object"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/metadata"
)

func createContentsHash(contents []byte) string {
	hash := md5.Sum(contents)
	return hex.EncodeToString(hash[:])
}

type rawObjectMatcher struct {
	uid          *string
	kind         *string
	createdRange []time.Time
	updatedRange []time.Time
	createdBy    string
	updatedBy    string
	body         []byte
	version      *string
}

type objectVersionMatcher struct {
	updatedRange []time.Time
	updatedBy    string
	version      *string
	etag         *string
	comment      *string
}

func timestampInRange(ts int64, tsRange []time.Time) bool {
	return ts >= tsRange[0].Unix() && ts <= tsRange[1].Unix()
}

func requireObjectMatch(t *testing.T, obj *object.RawObject, m rawObjectMatcher) {
	t.Helper()
	require.NotNil(t, obj)

	mismatches := ""
	if m.uid != nil && *m.uid != obj.UID {
		mismatches += fmt.Sprintf("expected UID: %s, actual UID: %s\n", *m.uid, obj.UID)
	}

	if m.kind != nil && *m.kind != obj.Kind {
		mismatches += fmt.Sprintf("expected kind: %s, actual kind: %s\n", *m.kind, obj.Kind)
	}

	if len(m.createdRange) == 2 && !timestampInRange(obj.Created, m.createdRange) {
		mismatches += fmt.Sprintf("expected createdBy range: [from %s to %s], actual created: %s\n", m.createdRange[0], m.createdRange[1], time.Unix(obj.Created, 0))
	}

	if len(m.updatedRange) == 2 && !timestampInRange(obj.Updated, m.updatedRange) {
		mismatches += fmt.Sprintf("expected updatedRange range: [from %s to %s], actual updated: %s\n", m.updatedRange[0], m.updatedRange[1], time.Unix(obj.Updated, 0))
	}

	if m.createdBy != "" && m.createdBy != obj.CreatedBy {
		mismatches += fmt.Sprintf("createdBy: expected:%s, found:%s\n", m.createdBy, obj.CreatedBy)
	}

	if m.updatedBy != "" && m.updatedBy != obj.UpdatedBy {
		mismatches += fmt.Sprintf("updatedBy: expected:%s, found:%s\n", m.updatedBy, obj.UpdatedBy)
	}

	if !reflect.DeepEqual(m.body, obj.Body) {
		mismatches += fmt.Sprintf("expected body len: %d, actual body len: %d\n", len(m.body), len(obj.Body))
	}

	expectedHash := createContentsHash(m.body)
	actualHash := createContentsHash(obj.Body)
	if expectedHash != actualHash {
		mismatches += fmt.Sprintf("expected body hash: %s, actual body hash: %s\n", expectedHash, actualHash)
	}

	if m.version != nil && *m.version != obj.Version {
		mismatches += fmt.Sprintf("expected version: %s, actual version: %s\n", *m.version, obj.Version)
	}

	require.True(t, len(mismatches) == 0, mismatches)
}

func requireVersionMatch(t *testing.T, obj *object.ObjectVersionInfo, m objectVersionMatcher) {
	t.Helper()
	mismatches := ""

	if m.etag != nil && *m.etag != obj.ETag {
		mismatches += fmt.Sprintf("expected etag: %s, actual etag: %s\n", *m.etag, obj.ETag)
	}

	if len(m.updatedRange) == 2 && !timestampInRange(obj.Updated, m.updatedRange) {
		mismatches += fmt.Sprintf("expected updatedRange range: [from %s to %s], actual updated: %s\n", m.updatedRange[0], m.updatedRange[1], time.Unix(obj.Updated, 0))
	}

	if m.updatedBy != "" && m.updatedBy != obj.UpdatedBy {
		mismatches += fmt.Sprintf("updatedBy: expected:%s, found:%s\n", m.updatedBy, obj.UpdatedBy)
	}

	if m.version != nil && *m.version != obj.Version {
		mismatches += fmt.Sprintf("expected version: %s, actual version: %s\n", *m.version, obj.Version)
	}

	require.True(t, len(mismatches) == 0, mismatches)
}

func TestObjectServer(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	testCtx := createTestContext(t)
	ctx = metadata.AppendToOutgoingContext(ctx, "authorization", fmt.Sprintf("Bearer %s", testCtx.authToken))

	fakeUser := fmt.Sprintf("user:%d:%s", testCtx.user.UserID, testCtx.user.Login)
	firstVersion := "1"
	kind := "dummy"
	uid := "my-test-entity"
	body := []byte("{\"name\":\"John\"}")
	testGRN := grn.GRN{
		TenantID:           testCtx.user.OrgID,
		ResourceKind:       kind,
		ResourceIdentifier: uid,
	}.String()

	t.Run("should not retrieve non-existent objects", func(t *testing.T) {
		resp, err := testCtx.client.Read(ctx, &object.ReadObjectRequest{
			GRN: testGRN,
		})
		require.NoError(t, err)

		require.NotNil(t, resp)
		require.Nil(t, resp.Object)
	})

	t.Run("should be able to read persisted objects", func(t *testing.T) {
		before := time.Now()
		writeReq := &object.WriteObjectRequest{
			GRN:     testGRN,
			Body:    body,
			Comment: "first entity!",
		}
		writeResp, err := testCtx.client.Write(ctx, writeReq)
		require.NoError(t, err)

		versionMatcher := objectVersionMatcher{
			updatedRange: []time.Time{before, time.Now()},
			updatedBy:    fakeUser,
			version:      &firstVersion,
			comment:      &writeReq.Comment,
		}
		requireVersionMatch(t, writeResp.Object, versionMatcher)

		readResp, err := testCtx.client.Read(ctx, &object.ReadObjectRequest{
			GRN:      testGRN,
			Version:  "",
			WithBody: true,
		})
		require.NoError(t, err)
		require.Nil(t, readResp.SummaryJson)

		objectMatcher := rawObjectMatcher{
			uid:          &uid,
			kind:         &kind,
			createdRange: []time.Time{before, time.Now()},
			updatedRange: []time.Time{before, time.Now()},
			createdBy:    fakeUser,
			updatedBy:    fakeUser,
			body:         body,
			version:      &firstVersion,
		}
		requireObjectMatch(t, readResp.Object, objectMatcher)

		deleteResp, err := testCtx.client.Delete(ctx, &object.DeleteObjectRequest{
			GRN:             testGRN,
			PreviousVersion: writeResp.Object.Version,
		})
		require.NoError(t, err)
		require.True(t, deleteResp.OK)

		readRespAfterDelete, err := testCtx.client.Read(ctx, &object.ReadObjectRequest{
			GRN:      testGRN,
			Version:  "",
			WithBody: true,
		})
		require.NoError(t, err)
		require.Nil(t, readRespAfterDelete.Object)
	})

	t.Run("should be able to update an object", func(t *testing.T) {
		before := time.Now()
		writeReq1 := &object.WriteObjectRequest{
			GRN:     testGRN,
			Body:    body,
			Comment: "first entity!",
		}
		writeResp1, err := testCtx.client.Write(ctx, writeReq1)
		require.NoError(t, err)
		require.Equal(t, object.WriteObjectResponse_CREATED, writeResp1.Status)

		body2 := []byte("{\"name\":\"John2\"}")

		writeReq2 := &object.WriteObjectRequest{
			GRN:     testGRN,
			Body:    body2,
			Comment: "update1",
		}
		writeResp2, err := testCtx.client.Write(ctx, writeReq2)
		require.NoError(t, err)
		require.NotEqual(t, writeResp1.Object.Version, writeResp2.Object.Version)

		// Duplicate write (no change)
		writeDupRsp, err := testCtx.client.Write(ctx, writeReq2)
		require.NoError(t, err)
		require.Nil(t, writeDupRsp.Error)
		require.Equal(t, object.WriteObjectResponse_UNCHANGED, writeDupRsp.Status)
		require.Equal(t, writeResp2.Object.Version, writeDupRsp.Object.Version)
		require.Equal(t, writeResp2.Object.ETag, writeDupRsp.Object.ETag)

		body3 := []byte("{\"name\":\"John3\"}")
		writeReq3 := &object.WriteObjectRequest{
			GRN:     testGRN,
			Body:    body3,
			Comment: "update3",
		}
		writeResp3, err := testCtx.client.Write(ctx, writeReq3)
		require.NoError(t, err)
		require.NotEqual(t, writeResp3.Object.Version, writeResp2.Object.Version)

		latestMatcher := rawObjectMatcher{
			uid:          &uid,
			kind:         &kind,
			createdRange: []time.Time{before, time.Now()},
			updatedRange: []time.Time{before, time.Now()},
			createdBy:    fakeUser,
			updatedBy:    fakeUser,
			body:         body3,
			version:      &writeResp3.Object.Version,
		}
		readRespLatest, err := testCtx.client.Read(ctx, &object.ReadObjectRequest{
			GRN:      testGRN,
			Version:  "", // latest
			WithBody: true,
		})
		require.NoError(t, err)
		require.Nil(t, readRespLatest.SummaryJson)
		requireObjectMatch(t, readRespLatest.Object, latestMatcher)

		readRespFirstVer, err := testCtx.client.Read(ctx, &object.ReadObjectRequest{
			GRN:      testGRN,
			Version:  writeResp1.Object.Version,
			WithBody: true,
		})

		require.NoError(t, err)
		require.Nil(t, readRespFirstVer.SummaryJson)
		require.NotNil(t, readRespFirstVer.Object)
		requireObjectMatch(t, readRespFirstVer.Object, rawObjectMatcher{
			uid:          &uid,
			kind:         &kind,
			createdRange: []time.Time{before, time.Now()},
			updatedRange: []time.Time{before, time.Now()},
			createdBy:    fakeUser,
			updatedBy:    fakeUser,
			body:         body,
			version:      &firstVersion,
		})

		history, err := testCtx.client.History(ctx, &object.ObjectHistoryRequest{
			GRN: testGRN,
		})
		require.NoError(t, err)
		require.Equal(t, []*object.ObjectVersionInfo{
			writeResp3.Object,
			writeResp2.Object,
			writeResp1.Object,
		}, history.Versions)

		deleteResp, err := testCtx.client.Delete(ctx, &object.DeleteObjectRequest{
			GRN:             testGRN,
			PreviousVersion: writeResp3.Object.Version,
		})
		require.NoError(t, err)
		require.True(t, deleteResp.OK)
	})

	t.Run("should be able to search for objects", func(t *testing.T) {
		uid2 := "uid2"
		uid3 := "uid3"
		uid4 := "uid4"
		kind2 := "kind2"
		w1, err := testCtx.client.Write(ctx, &object.WriteObjectRequest{
			GRN:  testGRN,
			Body: body,
		})
		require.NoError(t, err)

		w2, err := testCtx.client.Write(ctx, &object.WriteObjectRequest{
			GRN: grn.GRN{
				TenantID:           testCtx.user.OrgID,
				ResourceKind:       kind,
				ResourceIdentifier: uid2,
			}.String(),
			Body: body,
		})
		require.NoError(t, err)

		w3, err := testCtx.client.Write(ctx, &object.WriteObjectRequest{
			GRN: grn.GRN{
				TenantID:           testCtx.user.OrgID,
				ResourceKind:       kind2,
				ResourceIdentifier: uid3,
			}.String(),
			Body: body,
		})
		require.NoError(t, err)

		w4, err := testCtx.client.Write(ctx, &object.WriteObjectRequest{
			GRN: grn.GRN{
				TenantID:           testCtx.user.OrgID,
				ResourceKind:       kind2,
				ResourceIdentifier: uid4,
			}.String(),
			Body: body,
		})
		require.NoError(t, err)

		search, err := testCtx.client.Search(ctx, &object.ObjectSearchRequest{
			Kind:     []string{kind, kind2},
			WithBody: false,
		})
		require.NoError(t, err)

		require.NotNil(t, search)
		uids := make([]string, 0, len(search.Results))
		kinds := make([]string, 0, len(search.Results))
		version := make([]string, 0, len(search.Results))
		for _, res := range search.Results {
			uids = append(uids, res.UID)
			kinds = append(kinds, res.Kind)
			version = append(version, res.Version)
		}
		require.Equal(t, []string{"my-test-entity", "uid2", "uid3", "uid4"}, uids)
		require.Equal(t, []string{"dummy", "dummy", "kind2", "kind2"}, kinds)
		require.Equal(t, []string{
			w1.Object.Version,
			w2.Object.Version,
			w3.Object.Version,
			w4.Object.Version,
		}, version)

		// Again with only one kind
		searchKind1, err := testCtx.client.Search(ctx, &object.ObjectSearchRequest{
			Kind: []string{kind},
		})
		require.NoError(t, err)
		uids = make([]string, 0, len(searchKind1.Results))
		kinds = make([]string, 0, len(searchKind1.Results))
		version = make([]string, 0, len(searchKind1.Results))
		for _, res := range searchKind1.Results {
			uids = append(uids, res.UID)
			kinds = append(kinds, res.Kind)
			version = append(version, res.Version)
		}
		require.Equal(t, []string{"my-test-entity", "uid2"}, uids)
		require.Equal(t, []string{"dummy", "dummy"}, kinds)
		require.Equal(t, []string{
			w1.Object.Version,
			w2.Object.Version,
		}, version)
	})
}
