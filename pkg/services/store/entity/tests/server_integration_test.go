package entity_server_tests

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"reflect"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/metadata"

	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/util"
)

var (
	//go:embed testdata/dashboard-with-tags-b-g.json
	dashboardWithTagsBlueGreen string
	//go:embed testdata/dashboard-with-tags-r-g.json
	dashboardWithTagsRedGreen string
)

type rawEntityMatcher struct {
	grn          *entity.GRN
	createdRange []time.Time
	updatedRange []time.Time
	createdBy    string
	updatedBy    string
	body         []byte
	version      uint64 // zero is not checked
}

type objectVersionMatcher struct {
	updatedRange []time.Time
	updatedBy    string
	version      uint64 // zero is not checked
	etag         *string
	comment      *string
}

func timestampInRange(ts int64, tsRange []time.Time) bool {
	low := tsRange[0].UnixMilli() - 1
	high := tsRange[1].UnixMilli() + 1
	return ts >= low && ts <= high
}

func requireEntityMatch(t *testing.T, obj *entity.Entity, m rawEntityMatcher) {
	t.Helper()
	require.NotNil(t, obj)

	mismatches := ""
	if m.grn != nil {
		if m.grn.TenantId > 0 && m.grn.TenantId != obj.GRN.TenantId {
			mismatches += fmt.Sprintf("expected tenant: %d, actual: %d\n", m.grn.TenantId, obj.GRN.TenantId)
		}
		if m.grn.Kind != "" && m.grn.Kind != obj.GRN.Kind {
			mismatches += fmt.Sprintf("expected Kind: %s, actual: %s\n", m.grn.Kind, obj.GRN.Kind)
		}
		if m.grn.UID != "" && m.grn.UID != obj.GRN.UID {
			mismatches += fmt.Sprintf("expected UID: %s, actual: %s\n", m.grn.UID, obj.GRN.UID)
		}
	}

	if len(m.createdRange) == 2 && !timestampInRange(obj.CreatedAt, m.createdRange) {
		mismatches += fmt.Sprintf("expected Created range: [from %s to %s], actual created: %s\n", m.createdRange[0], m.createdRange[1], time.UnixMilli(obj.CreatedAt))
	}

	if len(m.updatedRange) == 2 && !timestampInRange(obj.UpdatedAt, m.updatedRange) {
		mismatches += fmt.Sprintf("expected Updated range: [from %s to %s], actual updated: %s\n", m.updatedRange[0], m.updatedRange[1], time.UnixMilli(obj.UpdatedAt))
	}

	if m.createdBy != "" && m.createdBy != obj.CreatedBy {
		mismatches += fmt.Sprintf("createdBy: expected:%s, found:%s\n", m.createdBy, obj.CreatedBy)
	}

	if m.updatedBy != "" && m.updatedBy != obj.UpdatedBy {
		mismatches += fmt.Sprintf("updatedBy: expected:%s, found:%s\n", m.updatedBy, obj.UpdatedBy)
	}

	if len(m.body) > 0 {
		if json.Valid(m.body) {
			require.JSONEq(t, string(m.body), string(obj.Body), "expecting same body")
		} else if !reflect.DeepEqual(m.body, obj.Body) {
			mismatches += fmt.Sprintf("expected body len: %d, actual body len: %d\n", len(m.body), len(obj.Body))
		}
	}

	if m.version > 0 && m.version != obj.Version {
		mismatches += fmt.Sprintf("expected version: %d, actual version: %d\n", m.version, obj.Version)
	}

	require.True(t, len(mismatches) == 0, mismatches)
}

func requireVersionMatch(t *testing.T, obj *entity.EntityVersionInfo, m objectVersionMatcher) {
	t.Helper()
	mismatches := ""

	if m.etag != nil && *m.etag != obj.ETag {
		mismatches += fmt.Sprintf("expected etag: %s, actual etag: %s\n", *m.etag, obj.ETag)
	}

	if len(m.updatedRange) == 2 && !timestampInRange(obj.UpdatedAt, m.updatedRange) {
		mismatches += fmt.Sprintf("expected updatedRange range: [from %s to %s], actual updated: %s\n", m.updatedRange[0], m.updatedRange[1], time.UnixMilli(obj.UpdatedAt))
	}

	if m.updatedBy != "" && m.updatedBy != obj.UpdatedBy {
		mismatches += fmt.Sprintf("updatedBy: expected:%s, found:%s\n", m.updatedBy, obj.UpdatedBy)
	}

	if m.version > 0 && m.version != obj.Version {
		mismatches += fmt.Sprintf("expected version: %d, actual version: %d\n", m.version, obj.Version)
	}

	require.True(t, len(mismatches) == 0, mismatches)
}

func TestIntegrationEntityServer(t *testing.T) {
	if true {
		// FIXME
		t.Skip()
	}

	if testing.Short() {
		t.Skip("skipping integration test")
	}

	testCtx := createTestContext(t)
	ctx := metadata.AppendToOutgoingContext(testCtx.ctx, "authorization", fmt.Sprintf("Bearer %s", testCtx.authToken))

	fakeUser := store.GetUserIDString(testCtx.user)
	firstVersion := uint64(1)
	kind := entity.StandardKindJSONObj
	grn := &entity.GRN{
		Kind: kind,
		UID:  "my-test-entity",
	}
	body := []byte("{\"name\":\"John\"}")

	t.Run("should not retrieve non-existent objects", func(t *testing.T) {
		resp, err := testCtx.client.Read(ctx, &entity.ReadEntityRequest{
			GRN: grn,
		})
		require.NoError(t, err)

		require.NotNil(t, resp)
		require.Nil(t, resp.GRN)
	})

	t.Run("should be able to read persisted objects", func(t *testing.T) {
		before := time.Now()
		writeReq := &entity.WriteEntityRequest{
			GRN:     grn,
			Body:    body,
			Comment: "first entity!",
		}
		writeResp, err := testCtx.client.Write(ctx, writeReq)
		require.NoError(t, err)

		versionMatcher := objectVersionMatcher{
			updatedRange: []time.Time{before, time.Now()},
			updatedBy:    fakeUser,
			version:      firstVersion,
			comment:      &writeReq.Comment,
		}
		requireVersionMatch(t, writeResp.Entity, versionMatcher)

		readResp, err := testCtx.client.Read(ctx, &entity.ReadEntityRequest{
			GRN:      grn,
			WithBody: true,
		})
		require.NoError(t, err)
		require.Nil(t, readResp.SummaryJson)
		require.NotNil(t, readResp)

		foundGRN := readResp.GRN
		require.NotNil(t, foundGRN)
		require.Equal(t, testCtx.user.OrgID, foundGRN.TenantId) // orgId becomes the tenant id when not set
		require.Equal(t, grn.Kind, foundGRN.Kind)
		require.Equal(t, grn.UID, foundGRN.UID)

		objectMatcher := rawEntityMatcher{
			grn:          grn,
			createdRange: []time.Time{before, time.Now()},
			updatedRange: []time.Time{before, time.Now()},
			createdBy:    fakeUser,
			updatedBy:    fakeUser,
			body:         body,
			version:      firstVersion,
		}
		requireEntityMatch(t, readResp, objectMatcher)

		deleteResp, err := testCtx.client.Delete(ctx, &entity.DeleteEntityRequest{
			GRN:             grn,
			PreviousVersion: writeResp.Entity.Version,
		})
		require.NoError(t, err)
		require.True(t, deleteResp.OK)

		readRespAfterDelete, err := testCtx.client.Read(ctx, &entity.ReadEntityRequest{
			GRN:      grn,
			WithBody: true,
		})
		require.NoError(t, err)
		require.Nil(t, readRespAfterDelete.GRN)
	})

	t.Run("should be able to update an object", func(t *testing.T) {
		before := time.Now()
		grn := &entity.GRN{
			Kind: kind,
			UID:  util.GenerateShortUID(),
		}

		writeReq1 := &entity.WriteEntityRequest{
			GRN:     grn,
			Body:    body,
			Comment: "first entity!",
		}
		writeResp1, err := testCtx.client.Write(ctx, writeReq1)
		require.NoError(t, err)
		require.Equal(t, entity.WriteEntityResponse_CREATED, writeResp1.Status)

		body2 := []byte("{\"name\":\"John2\"}")

		writeReq2 := &entity.WriteEntityRequest{
			GRN:     grn,
			Body:    body2,
			Comment: "update1",
		}
		writeResp2, err := testCtx.client.Write(ctx, writeReq2)
		require.NoError(t, err)
		require.NotEqual(t, writeResp1.Entity.Version, writeResp2.Entity.Version)

		// Duplicate write (no change)
		writeDupRsp, err := testCtx.client.Write(ctx, writeReq2)
		require.NoError(t, err)
		require.Nil(t, writeDupRsp.Error)
		require.Equal(t, entity.WriteEntityResponse_UNCHANGED, writeDupRsp.Status)
		require.Equal(t, writeResp2.Entity.Version, writeDupRsp.Entity.Version)
		require.Equal(t, writeResp2.Entity.ETag, writeDupRsp.Entity.ETag)

		body3 := []byte("{\"name\":\"John3\"}")
		writeReq3 := &entity.WriteEntityRequest{
			GRN:     grn,
			Body:    body3,
			Comment: "update3",
		}
		writeResp3, err := testCtx.client.Write(ctx, writeReq3)
		require.NoError(t, err)
		require.NotEqual(t, writeResp3.Entity.Version, writeResp2.Entity.Version)

		latestMatcher := rawEntityMatcher{
			grn:          grn,
			createdRange: []time.Time{before, time.Now()},
			updatedRange: []time.Time{before, time.Now()},
			createdBy:    fakeUser,
			updatedBy:    fakeUser,
			body:         body3,
			version:      writeResp3.Entity.Version,
		}
		readRespLatest, err := testCtx.client.Read(ctx, &entity.ReadEntityRequest{
			GRN:      grn,
			WithBody: true,
		})
		require.NoError(t, err)
		require.Nil(t, readRespLatest.SummaryJson)
		requireEntityMatch(t, readRespLatest, latestMatcher)

		readRespFirstVer, err := testCtx.client.Read(ctx, &entity.ReadEntityRequest{
			GRN:      grn,
			Version:  writeResp1.Entity.Version,
			WithBody: true,
		})

		require.NoError(t, err)
		require.Nil(t, readRespFirstVer.SummaryJson)
		require.NotNil(t, readRespFirstVer)
		requireEntityMatch(t, readRespFirstVer, rawEntityMatcher{
			grn:          grn,
			createdRange: []time.Time{before, time.Now()},
			updatedRange: []time.Time{before, time.Now()},
			createdBy:    fakeUser,
			updatedBy:    fakeUser,
			body:         body,
			version:      firstVersion,
		})

		history, err := testCtx.client.History(ctx, &entity.EntityHistoryRequest{
			GRN: grn,
		})
		require.NoError(t, err)
		require.Equal(t, []*entity.EntityVersionInfo{
			writeResp3.Entity,
			writeResp2.Entity,
			writeResp1.Entity,
		}, history.Versions)

		deleteResp, err := testCtx.client.Delete(ctx, &entity.DeleteEntityRequest{
			GRN:             grn,
			PreviousVersion: writeResp3.Entity.Version,
		})
		require.NoError(t, err)
		require.True(t, deleteResp.OK)
	})

	t.Run("should be able to search for objects", func(t *testing.T) {
		uid2 := "uid2"
		uid3 := "uid3"
		uid4 := "uid4"
		kind2 := entity.StandardKindPlaylist
		w1, err := testCtx.client.Write(ctx, &entity.WriteEntityRequest{
			GRN:  grn,
			Body: body,
		})
		require.NoError(t, err)

		w2, err := testCtx.client.Write(ctx, &entity.WriteEntityRequest{
			GRN: &entity.GRN{
				UID:  uid2,
				Kind: kind,
			},
			Body: body,
		})
		require.NoError(t, err)

		w3, err := testCtx.client.Write(ctx, &entity.WriteEntityRequest{
			GRN: &entity.GRN{
				UID:  uid3,
				Kind: kind2,
			},
			Body: body,
		})
		require.NoError(t, err)

		w4, err := testCtx.client.Write(ctx, &entity.WriteEntityRequest{
			GRN: &entity.GRN{
				UID:  uid4,
				Kind: kind2,
			},
			Body: body,
		})
		require.NoError(t, err)

		search, err := testCtx.client.Search(ctx, &entity.EntitySearchRequest{
			Kind:     []string{kind, kind2},
			WithBody: false,
		})
		require.NoError(t, err)

		require.NotNil(t, search)
		uids := make([]string, 0, len(search.Results))
		kinds := make([]string, 0, len(search.Results))
		version := make([]uint64, 0, len(search.Results))
		for _, res := range search.Results {
			uids = append(uids, res.GRN.UID)
			kinds = append(kinds, res.GRN.Kind)
			version = append(version, res.Version)
		}
		require.Equal(t, []string{"my-test-entity", "uid2", "uid3", "uid4"}, uids)
		require.Equal(t, []string{"jsonobj", "jsonobj", "playlist", "playlist"}, kinds)
		require.Equal(t, []uint64{
			w1.Entity.Version,
			w2.Entity.Version,
			w3.Entity.Version,
			w4.Entity.Version,
		}, version)

		// Again with only one kind
		searchKind1, err := testCtx.client.Search(ctx, &entity.EntitySearchRequest{
			Kind: []string{kind},
		})
		require.NoError(t, err)
		uids = make([]string, 0, len(searchKind1.Results))
		kinds = make([]string, 0, len(searchKind1.Results))
		version = make([]uint64, 0, len(searchKind1.Results))
		for _, res := range searchKind1.Results {
			uids = append(uids, res.GRN.UID)
			kinds = append(kinds, res.GRN.Kind)
			version = append(version, res.Version)
		}
		require.Equal(t, []string{"my-test-entity", "uid2"}, uids)
		require.Equal(t, []string{"jsonobj", "jsonobj"}, kinds)
		require.Equal(t, []uint64{
			w1.Entity.Version,
			w2.Entity.Version,
		}, version)
	})

	t.Run("should be able to filter objects based on their labels", func(t *testing.T) {
		kind := entity.StandardKindDashboard
		_, err := testCtx.client.Write(ctx, &entity.WriteEntityRequest{
			GRN: &entity.GRN{
				Kind: kind,
				UID:  "blue-green",
			},
			Body: []byte(dashboardWithTagsBlueGreen),
		})
		require.NoError(t, err)

		_, err = testCtx.client.Write(ctx, &entity.WriteEntityRequest{
			GRN: &entity.GRN{
				Kind: kind,
				UID:  "red-green",
			},
			Body: []byte(dashboardWithTagsRedGreen),
		})
		require.NoError(t, err)

		search, err := testCtx.client.Search(ctx, &entity.EntitySearchRequest{
			Kind:       []string{kind},
			WithBody:   false,
			WithLabels: true,
			Labels: map[string]string{
				"red": "",
			},
		})
		require.NoError(t, err)
		require.NotNil(t, search)
		require.Len(t, search.Results, 1)
		require.Equal(t, search.Results[0].GRN.UID, "red-green")

		search, err = testCtx.client.Search(ctx, &entity.EntitySearchRequest{
			Kind:       []string{kind},
			WithBody:   false,
			WithLabels: true,
			Labels: map[string]string{
				"red":   "",
				"green": "",
			},
		})
		require.NoError(t, err)
		require.NotNil(t, search)
		require.Len(t, search.Results, 1)
		require.Equal(t, search.Results[0].GRN.UID, "red-green")

		search, err = testCtx.client.Search(ctx, &entity.EntitySearchRequest{
			Kind:       []string{kind},
			WithBody:   false,
			WithLabels: true,
			Labels: map[string]string{
				"red": "invalid",
			},
		})
		require.NoError(t, err)
		require.NotNil(t, search)
		require.Len(t, search.Results, 0)

		search, err = testCtx.client.Search(ctx, &entity.EntitySearchRequest{
			Kind:       []string{kind},
			WithBody:   false,
			WithLabels: true,
			Labels: map[string]string{
				"green": "",
			},
		})
		require.NoError(t, err)
		require.NotNil(t, search)
		require.Len(t, search.Results, 2)

		search, err = testCtx.client.Search(ctx, &entity.EntitySearchRequest{
			Kind:       []string{kind},
			WithBody:   false,
			WithLabels: true,
			Labels: map[string]string{
				"yellow": "",
			},
		})
		require.NoError(t, err)
		require.NotNil(t, search)
		require.Len(t, search.Results, 0)
	})
}
