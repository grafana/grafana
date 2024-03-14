package entity_server_tests

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"os"
	"reflect"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/store/entity"
)

var (
	//go:embed testdata/dashboard-with-tags-b-g.json
	dashboardWithTagsBlueGreen string
	//go:embed testdata/dashboard-with-tags-r-g.json
	dashboardWithTagsRedGreen string
)

type rawEntityMatcher struct {
	key          string
	createdRange []time.Time
	updatedRange []time.Time
	createdBy    string
	updatedBy    string
	body         []byte
	version      int64
}

type objectVersionMatcher struct {
	updatedRange []time.Time
	updatedBy    string
	version      int64
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
	if m.key != "" && m.key != obj.Key {
		mismatches += fmt.Sprintf("expected key: %s, actual: %s\n", m.key, obj.Key)
	}

	if len(m.createdRange) == 2 && !timestampInRange(obj.CreatedAt, m.createdRange) {
		mismatches += fmt.Sprintf("expected Created range: [from %s to %s], actual created: %s\n", m.createdRange[0], m.createdRange[1], time.UnixMilli(obj.CreatedAt))
	}

	if len(m.updatedRange) == 2 && !timestampInRange(obj.UpdatedAt, m.updatedRange) {
		mismatches += fmt.Sprintf("expected Updated range: [from %s to %s], actual updated: %s\n", m.updatedRange[0], m.updatedRange[1], time.UnixMilli(obj.UpdatedAt))
	}

	if m.createdBy != "" && m.createdBy != obj.CreatedBy {
		mismatches += fmt.Sprintf("createdBy: expected: '%s', found: '%s'\n", m.createdBy, obj.CreatedBy)
	}

	if m.updatedBy != "" && m.updatedBy != obj.UpdatedBy {
		mismatches += fmt.Sprintf("updatedBy: expected: '%s', found: '%s'\n", m.updatedBy, obj.UpdatedBy)
	}

	if len(m.body) > 0 {
		if json.Valid(m.body) {
			require.JSONEq(t, string(m.body), string(obj.Body), "expecting same body")
		} else if !reflect.DeepEqual(m.body, obj.Body) {
			mismatches += fmt.Sprintf("expected body len: %d, actual body len: %d\n", len(m.body), len(obj.Body))
		}
	}

	if m.version != 0 && m.version != obj.ResourceVersion {
		mismatches += fmt.Sprintf("expected version: %d, actual version: %d\n", m.version, obj.ResourceVersion)
	}

	require.True(t, len(mismatches) == 0, mismatches)
}

func requireVersionMatch(t *testing.T, obj *entity.Entity, m objectVersionMatcher) {
	t.Helper()
	mismatches := ""

	if m.etag != nil && *m.etag != obj.ETag {
		mismatches += fmt.Sprintf("expected etag: %s, actual etag: %s\n", *m.etag, obj.ETag)
	}

	if len(m.updatedRange) == 2 && !timestampInRange(obj.UpdatedAt, m.updatedRange) {
		mismatches += fmt.Sprintf("expected updatedRange range: [from %s to %s], actual updated: %s\n", m.updatedRange[0], m.updatedRange[1], time.UnixMilli(obj.UpdatedAt))
	}

	if m.updatedBy != "" && m.updatedBy != obj.UpdatedBy {
		mismatches += fmt.Sprintf("updatedBy: expected: '%s', found: '%s'\n", m.updatedBy, obj.UpdatedBy)
	}

	if m.version != 0 && m.version != obj.ResourceVersion {
		mismatches += fmt.Sprintf("expected version: %d, actual version: %d\n", m.version, obj.ResourceVersion)
	}

	require.True(t, len(mismatches) == 0, mismatches)
}

func TestIntegrationWatch(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	testCtx := createTestContext(t)

	// Update env with entity_api db config
	dbType := os.Getenv("GRAFANA_TEST_DB")
	err := addUnifiedStorageConfig(t, testCtx, dbType)
	require.NoError(t, err)

	t.Run("test should not receive events for keys we are not watching", func(t *testing.T) {
		group := "test.grafana.app"
		resource := "jsonobjs"
		namespace := "default"
		body := []byte("{\"name\":\"John\"}")
		name := "test1"
		key := "/" + group + "/" + resource + "/namespaces/" + namespace + "/" + name
		otherKey := "/" + group + "/" + resource + "/namespaces/" + namespace + "/" + "otherName"

		// create watch client and timeout after 5 seconds of waiting for an event
		ctx := testCtx.ctx
		ctx, cancel := context.WithTimeout(ctx, time.Second*10)
		defer cancel()
		watchClient := newWatchClient(t, ctx, testCtx.client, otherKey)

		// create entity
		createReq := &entity.CreateEntityRequest{
			Entity: &entity.Entity{
				Key:       key,
				Group:     group,
				Resource:  resource,
				Namespace: namespace,
				Name:      name,
				Body:      body,
				Message:   "first entity!",
			},
		}
		_, err = testCtx.client.Create(ctx, createReq)
		require.NoError(t, err)

		//delete entity
		_, err = testCtx.client.Delete(ctx, &entity.DeleteEntityRequest{Key: key})
		require.NoError(t, err)

		// watch client should receive nothing and timeout after 5 seconds
		resp, err := watchClient.Recv()
		require.Nil(t, resp)
		require.Error(t, err)
		require.ErrorContainsf(t, err, "context deadline exceeded", err.Error())
	})

	t.Run("watch will receive events for create, update, and delete", func(t *testing.T) {
		if testing.Short() {
			t.Skip("skipping integration test")
		}

		group := "test.grafana.app"
		resource := "jsonobjs"
		namespace := "default"
		body := []byte("{\"name\":\"John\"}")
		name := "test2"
		key := "/" + group + "/" + resource + "/" + namespace + "/" + name

		// create watch client and listen for events
		watchClient := newWatchClient(t, testCtx.ctx, testCtx.client, key)

		// create entity
		createReq := &entity.CreateEntityRequest{
			Entity: &entity.Entity{
				Key:       key,
				Group:     group,
				Resource:  resource,
				Namespace: namespace,
				Name:      name,
				Body:      body,
				Message:   "first entity!",
			},
		}
		_, err = testCtx.client.Create(testCtx.ctx, createReq)
		require.NoError(t, err)

		// watch client receives create
		res, err := watchClient.Recv()
		require.NoError(t, err)
		require.Equal(t, key, res.Entity.Key)
		require.Equal(t, entity.Entity_CREATED, res.Entity.Action)

		// update entity
		body2 := []byte("{\"name\":\"John2\"}")
		updateReq := &entity.UpdateEntityRequest{
			Entity: &entity.Entity{
				Key:     key,
				Body:    body2,
				Message: "update1",
			},
		}
		updateResp, err := testCtx.client.Update(testCtx.ctx, updateReq)
		require.NoError(t, err)
		require.Equal(t, entity.Entity_UPDATED, updateResp.Entity.Action)

		// watch client receives update
		res, err = watchClient.Recv()
		require.NoError(t, err)
		require.Equal(t, key, res.Entity.Key)
		require.Equal(t, entity.Entity_UPDATED, res.Entity.Action)

		// delete entity
		_, err = testCtx.client.Delete(testCtx.ctx, &entity.DeleteEntityRequest{
			Key:             key,
			PreviousVersion: res.Entity.ResourceVersion,
		})
		require.NoError(t, err)

		// watch client receives delete
		res, err = watchClient.Recv()
		require.NoError(t, err)
		require.Equal(t, key, res.Entity.Key)
		require.Equal(t, entity.Entity_DELETED, res.Entity.Action)
	})
}

func addUnifiedStorageConfig(t *testing.T, testCtx testContext, dbType string) error {
	s, _ := testCtx.testEnv.SQLStore.Cfg.Raw.NewSection("entity_api")
	_, err := s.NewKey("db_type", dbType)
	require.NoError(t, err)
	_, _ = s.NewKey("db_host", "localhost")
	_, _ = s.NewKey("db_name", "grafanatest")
	_, _ = s.NewKey("db_user", "grafanatest")
	_, _ = s.NewKey("db_pass", "grafanatest")
	return err
}

func TestIntegrationEntityServer(t *testing.T) {
	// TODO figure out why this still runs into sqlite database locked error
	if true {
		t.Skip("skipping integration test")
	}

	if testing.Short() {
		t.Skip("skipping integration test")
	}

	testCtx := createTestContext(t)
	ctx := appcontext.WithUser(testCtx.ctx, testCtx.user)

	fakeUser := store.GetUserIDString(testCtx.user)
	firstVersion := int64(0)
	group := "test.grafana.app"
	resource := "jsonobjs"
	resource2 := "playlists"
	namespace := "default"
	name := "my-test-entity"
	testKey := "/" + group + "/" + resource + "/namespaces/" + namespace + "/" + name
	testKey2 := "/" + group + "/" + resource2 + "/namespaces/" + namespace + "/" + name
	body := []byte("{\"name\":\"John\"}")

	t.Run("should not retrieve non-existent objects", func(t *testing.T) {
		resp, err := testCtx.client.Read(ctx, &entity.ReadEntityRequest{
			Key: testKey,
		})
		require.NoError(t, err)

		require.NotNil(t, resp)
		require.Empty(t, resp.Key)
	})

	t.Run("should be able to read persisted objects", func(t *testing.T) {
		before := time.Now()
		createReq := &entity.CreateEntityRequest{
			Entity: &entity.Entity{
				Key:       testKey,
				Group:     group,
				Resource:  resource,
				Namespace: namespace,
				Name:      name,
				Body:      body,
				Message:   "first entity!",
			},
		}
		createResp, err := testCtx.client.Create(ctx, createReq)
		require.NoError(t, err)

		// clean up in case test fails
		t.Cleanup(func() {
			_, _ = testCtx.client.Delete(ctx, &entity.DeleteEntityRequest{
				Key: testKey,
			})
		})

		versionMatcher := objectVersionMatcher{
			// updatedRange: []time.Time{before, time.Now()},
			// updatedBy:    fakeUser,
			version: firstVersion,
			comment: &createReq.Entity.Message,
		}
		requireVersionMatch(t, createResp.Entity, versionMatcher)

		readResp, err := testCtx.client.Read(ctx, &entity.ReadEntityRequest{
			Key:             testKey,
			ResourceVersion: 0,
			WithBody:        true,
		})
		require.NoError(t, err)
		require.NotNil(t, readResp)

		require.Equal(t, testKey, readResp.Key)
		require.Equal(t, namespace, readResp.Namespace) // orgId becomes the tenant id when not set
		require.Equal(t, resource, readResp.Resource)
		require.Equal(t, name, readResp.Name)

		objectMatcher := rawEntityMatcher{
			key:          testKey,
			createdRange: []time.Time{before, time.Now()},
			// updatedRange: []time.Time{before, time.Now()},
			createdBy: fakeUser,
			// updatedBy:    fakeUser,
			body:    body,
			version: firstVersion,
		}
		requireEntityMatch(t, readResp, objectMatcher)

		deleteResp, err := testCtx.client.Delete(ctx, &entity.DeleteEntityRequest{
			Key:             testKey,
			PreviousVersion: readResp.ResourceVersion,
		})
		require.NoError(t, err)
		require.Equal(t, deleteResp.Status, entity.DeleteEntityResponse_DELETED)

		readRespAfterDelete, err := testCtx.client.Read(ctx, &entity.ReadEntityRequest{
			Key:             testKey,
			ResourceVersion: 0,
			WithBody:        true,
		})
		require.NoError(t, err)
		require.Empty(t, readRespAfterDelete.Key)
	})

	t.Run("should be able to update an object", func(t *testing.T) {
		before := time.Now()

		createReq := &entity.CreateEntityRequest{
			Entity: &entity.Entity{
				Key:       testKey,
				Group:     group,
				Resource:  resource,
				Namespace: namespace,
				Name:      name,
				Body:      body,
				Message:   "first entity!",
			},
		}
		createResp, err := testCtx.client.Create(ctx, createReq)
		require.NoError(t, err)

		// clean up in case test fails
		t.Cleanup(func() {
			_, _ = testCtx.client.Delete(ctx, &entity.DeleteEntityRequest{
				Key: testKey,
			})
		})

		require.Equal(t, entity.CreateEntityResponse_CREATED, createResp.Status)

		body2 := []byte("{\"name\":\"John2\"}")

		updateReq := &entity.UpdateEntityRequest{
			Entity: &entity.Entity{
				Key:     testKey,
				Body:    body2,
				Message: "update1",
			},
		}
		updateResp, err := testCtx.client.Update(ctx, updateReq)
		require.NoError(t, err)
		require.NotEqual(t, createResp.Entity.ResourceVersion, updateResp.Entity.ResourceVersion)

		// Duplicate write (no change)
		/*
			writeDupRsp, err := testCtx.client.Update(ctx, updateReq)
			require.NoError(t, err)
			require.Nil(t, writeDupRsp.Error)
			require.Equal(t, entity.UpdateEntityResponse_UNCHANGED, writeDupRsp.Status)
			require.Equal(t, updateResp.Entity.ResourceVersion, writeDupRsp.Entity.ResourceVersion)
			require.Equal(t, updateResp.Entity.ETag, writeDupRsp.Entity.ETag)
		*/

		body3 := []byte("{\"name\":\"John3\"}")
		writeReq3 := &entity.UpdateEntityRequest{
			Entity: &entity.Entity{
				Key:     testKey,
				Body:    body3,
				Message: "update3",
			},
		}
		writeResp3, err := testCtx.client.Update(ctx, writeReq3)
		require.NoError(t, err)
		require.Equal(t, entity.UpdateEntityResponse_UPDATED, writeResp3.Status)
		require.NotEqual(t, writeResp3.Entity.ResourceVersion, updateResp.Entity.ResourceVersion)

		latestMatcher := rawEntityMatcher{
			key:          testKey,
			createdRange: []time.Time{before, time.Now()},
			updatedRange: []time.Time{before, time.Now()},
			createdBy:    fakeUser,
			updatedBy:    fakeUser,
			body:         body3,
			version:      writeResp3.Entity.ResourceVersion,
		}
		readRespLatest, err := testCtx.client.Read(ctx, &entity.ReadEntityRequest{
			Key:             testKey,
			ResourceVersion: 0, // latest
			WithBody:        true,
		})
		require.NoError(t, err)
		requireEntityMatch(t, readRespLatest, latestMatcher)

		readRespFirstVer, err := testCtx.client.Read(ctx, &entity.ReadEntityRequest{
			Key:             testKey,
			ResourceVersion: createResp.Entity.ResourceVersion,
			WithBody:        true,
		})

		require.NoError(t, err)
		require.NotNil(t, readRespFirstVer)
		requireEntityMatch(t, readRespFirstVer, rawEntityMatcher{
			key:          testKey,
			createdRange: []time.Time{before, time.Now()},
			createdBy:    fakeUser,
			body:         body,
			version:      0,
		})

		history, err := testCtx.client.History(ctx, &entity.EntityHistoryRequest{
			Key: testKey,
		})
		require.NoError(t, err)
		require.Equal(t, []*entity.Entity{
			writeResp3.Entity,
			updateResp.Entity,
			createResp.Entity,
		}, history.Versions)

		deleteResp, err := testCtx.client.Delete(ctx, &entity.DeleteEntityRequest{
			Key:             testKey,
			PreviousVersion: writeResp3.Entity.ResourceVersion,
		})
		require.NoError(t, err)
		require.Equal(t, deleteResp.Status, entity.DeleteEntityResponse_DELETED)
	})

	t.Run("should be able to list objects", func(t *testing.T) {
		w1, err := testCtx.client.Create(ctx, &entity.CreateEntityRequest{
			Entity: &entity.Entity{
				Key:  testKey + "1",
				Body: body,
			},
		})
		require.NoError(t, err)

		w2, err := testCtx.client.Create(ctx, &entity.CreateEntityRequest{
			Entity: &entity.Entity{
				Key:  testKey + "2",
				Body: body,
			},
		})
		require.NoError(t, err)

		w3, err := testCtx.client.Create(ctx, &entity.CreateEntityRequest{
			Entity: &entity.Entity{
				Key:  testKey2 + "3",
				Body: body,
			},
		})
		require.NoError(t, err)

		w4, err := testCtx.client.Create(ctx, &entity.CreateEntityRequest{
			Entity: &entity.Entity{
				Key:  testKey2 + "4",
				Body: body,
			},
		})
		require.NoError(t, err)

		resp, err := testCtx.client.List(ctx, &entity.EntityListRequest{
			Resource: []string{resource, resource2},
			WithBody: false,
		})
		require.NoError(t, err)

		require.NotNil(t, resp)
		names := make([]string, 0, len(resp.Results))
		kinds := make([]string, 0, len(resp.Results))
		version := make([]int64, 0, len(resp.Results))
		for _, res := range resp.Results {
			names = append(names, res.Name)
			kinds = append(kinds, res.Resource)
			version = append(version, res.ResourceVersion)
		}

		// default sort is by guid, so we ignore order
		require.ElementsMatch(t, []string{"my-test-entity1", "my-test-entity2", "my-test-entity3", "my-test-entity4"}, names)
		require.ElementsMatch(t, []string{"jsonobjs", "jsonobjs", "playlists", "playlists"}, kinds)
		require.ElementsMatch(t, []int64{
			w1.Entity.ResourceVersion,
			w2.Entity.ResourceVersion,
			w3.Entity.ResourceVersion,
			w4.Entity.ResourceVersion,
		}, version)

		// sorted by name
		resp, err = testCtx.client.List(ctx, &entity.EntityListRequest{
			Resource: []string{resource, resource2},
			WithBody: false,
			Sort:     []string{"name"},
		})
		require.NoError(t, err)

		require.NotNil(t, resp)
		require.Equal(t, 4, len(resp.Results))

		require.Equal(t, "my-test-entity1", resp.Results[0].Name)
		require.Equal(t, "my-test-entity2", resp.Results[1].Name)
		require.Equal(t, "my-test-entity3", resp.Results[2].Name)
		require.Equal(t, "my-test-entity4", resp.Results[3].Name)

		require.Equal(t, "jsonobjs", resp.Results[0].Resource)
		require.Equal(t, "jsonobjs", resp.Results[1].Resource)
		require.Equal(t, "playlists", resp.Results[2].Resource)
		require.Equal(t, "playlists", resp.Results[3].Resource)

		// sorted by name desc
		resp, err = testCtx.client.List(ctx, &entity.EntityListRequest{
			Resource: []string{resource, resource2},
			WithBody: false,
			Sort:     []string{"name_desc"},
		})
		require.NoError(t, err)

		require.NotNil(t, resp)
		require.Equal(t, 4, len(resp.Results))

		require.Equal(t, "my-test-entity1", resp.Results[3].Name)
		require.Equal(t, "my-test-entity2", resp.Results[2].Name)
		require.Equal(t, "my-test-entity3", resp.Results[1].Name)
		require.Equal(t, "my-test-entity4", resp.Results[0].Name)

		require.Equal(t, "jsonobjs", resp.Results[3].Resource)
		require.Equal(t, "jsonobjs", resp.Results[2].Resource)
		require.Equal(t, "playlists", resp.Results[1].Resource)
		require.Equal(t, "playlists", resp.Results[0].Resource)

		// with limit
		resp, err = testCtx.client.List(ctx, &entity.EntityListRequest{
			Resource: []string{resource, resource2},
			WithBody: false,
			Limit:    2,
			Sort:     []string{"name"},
		})
		require.NoError(t, err)

		require.NotNil(t, resp)
		require.Equal(t, 2, len(resp.Results))

		require.Equal(t, "my-test-entity1", resp.Results[0].Name)
		require.Equal(t, "my-test-entity2", resp.Results[1].Name)

		// with limit & continue
		resp, err = testCtx.client.List(ctx, &entity.EntityListRequest{
			Resource:      []string{resource, resource2},
			WithBody:      false,
			Limit:         2,
			NextPageToken: resp.NextPageToken,
			Sort:          []string{"name"},
		})
		require.NoError(t, err)

		require.NotNil(t, resp)
		require.Equal(t, 2, len(resp.Results))

		require.Equal(t, "my-test-entity3", resp.Results[0].Name)
		require.Equal(t, "my-test-entity4", resp.Results[1].Name)

		// Again with only one kind
		respKind1, err := testCtx.client.List(ctx, &entity.EntityListRequest{
			Resource: []string{resource},
			Sort:     []string{"name"},
		})
		require.NoError(t, err)
		names = make([]string, 0, len(respKind1.Results))
		kinds = make([]string, 0, len(respKind1.Results))
		version = make([]int64, 0, len(respKind1.Results))
		for _, res := range respKind1.Results {
			names = append(names, res.Name)
			kinds = append(kinds, res.Resource)
			version = append(version, res.ResourceVersion)
		}
		require.Equal(t, []string{"my-test-entity1", "my-test-entity2"}, names)
		require.Equal(t, []string{"jsonobjs", "jsonobjs"}, kinds)
		require.Equal(t, []int64{
			w1.Entity.ResourceVersion,
			w2.Entity.ResourceVersion,
		}, version)
	})

	t.Run("should be able to filter objects based on their labels", func(t *testing.T) {
		_, err := testCtx.client.Create(ctx, &entity.CreateEntityRequest{
			Entity: &entity.Entity{
				Key:  "/dashboards.grafana.app/dashboards/namespaces/default/blue-green",
				Body: []byte(dashboardWithTagsBlueGreen),
				Labels: map[string]string{
					"blue":  "",
					"green": "",
				},
			},
		})
		require.NoError(t, err)

		_, err = testCtx.client.Create(ctx, &entity.CreateEntityRequest{
			Entity: &entity.Entity{
				Key:  "/dashboards.grafana.app/dashboards/namespaces/default/red-green",
				Body: []byte(dashboardWithTagsRedGreen),
				Labels: map[string]string{
					"red":   "",
					"green": "",
				},
			},
		})
		require.NoError(t, err)

		resp, err := testCtx.client.List(ctx, &entity.EntityListRequest{
			Key:      []string{"/dashboards.grafana.app/dashboards/namespaces/default"},
			WithBody: false,
			Labels: map[string]string{
				"red": "",
			},
		})
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Len(t, resp.Results, 1)
		require.Equal(t, resp.Results[0].Name, "red-green")

		resp, err = testCtx.client.List(ctx, &entity.EntityListRequest{
			Key:      []string{"/dashboards.grafana.app/dashboards/namespaces/default"},
			WithBody: false,
			Labels: map[string]string{
				"red":   "",
				"green": "",
			},
		})
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Len(t, resp.Results, 1)
		require.Equal(t, resp.Results[0].Name, "red-green")

		resp, err = testCtx.client.List(ctx, &entity.EntityListRequest{
			Key:      []string{"/dashboards.grafana.app/dashboards/namespaces/default"},
			WithBody: false,
			Labels: map[string]string{
				"red": "invalid",
			},
		})
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Len(t, resp.Results, 0)

		resp, err = testCtx.client.List(ctx, &entity.EntityListRequest{
			Key:      []string{"/dashboards.grafana.app/dashboards/namespaces/default"},
			WithBody: false,
			Labels: map[string]string{
				"green": "",
			},
		})
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Len(t, resp.Results, 2)

		resp, err = testCtx.client.List(ctx, &entity.EntityListRequest{
			Key:      []string{"/dashboards.grafana.app/dashboards/namespaces/default"},
			WithBody: false,
			Labels: map[string]string{
				"yellow": "",
			},
		})
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Len(t, resp.Results, 0)
	})
}

func newWatchClient(t *testing.T, ctx context.Context, client entity.EntityStoreClient, key string) entity.EntityStore_WatchClient {
	watchReq := &entity.EntityWatchRequest{
		Since: 0,
		Key:   []string{key},
	}
	watchClient, err := client.Watch(ctx, watchReq)
	require.NoError(t, err)

	return watchClient
}
