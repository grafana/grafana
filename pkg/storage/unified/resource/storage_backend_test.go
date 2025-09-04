package resource

import (
	"context"
	"fmt"
	"io"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func setupTestStorageBackend(t *testing.T) *kvStorageBackend {
	kv := setupTestKV(t)
	opts := KvBackendOptions{
		KvStore:    kv,
		WithPruner: true,
	}
	backend, err := NewKvStorageBackend(opts)
	require.NoError(t, err)
	return backend
}

func TestNewKvStorageBackend(t *testing.T) {
	backend := setupTestStorageBackend(t)

	assert.NotNil(t, backend)
	assert.NotNil(t, backend.kv)
	assert.NotNil(t, backend.dataStore)
	assert.NotNil(t, backend.metaStore)
	assert.NotNil(t, backend.eventStore)
	assert.NotNil(t, backend.notifier)
	assert.NotNil(t, backend.snowflake)
}

func TestKvStorageBackend_WriteEvent_Success(t *testing.T) {
	backend := setupTestStorageBackend(t)
	ctx := context.Background()

	tests := []struct {
		name      string
		eventType resourcepb.WatchEvent_Type
	}{
		{
			name:      "write ADDED event",
			eventType: resourcepb.WatchEvent_ADDED,
		},
		{
			name:      "write MODIFIED event",
			eventType: resourcepb.WatchEvent_MODIFIED,
		},
		{
			name:      "write DELETED event",
			eventType: resourcepb.WatchEvent_DELETED,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			testObj, err := createTestObject()
			require.NoError(t, err)

			metaAccessor, err := utils.MetaAccessor(testObj)
			require.NoError(t, err)

			writeEvent := WriteEvent{
				Type: tt.eventType,
				Key: &resourcepb.ResourceKey{
					Namespace: "default",
					Group:     "apps",
					Resource:  "resources",
					Name:      "test-resource",
				},
				Value:      objectToJSONBytes(t, testObj),
				Object:     metaAccessor,
				ObjectOld:  metaAccessor,
				PreviousRV: 100,
			}

			rv, err := backend.WriteEvent(ctx, writeEvent)
			require.NoError(t, err)
			assert.Greater(t, rv, int64(0), "resource version should be positive")

			// Verify data was written to dataStore
			var expectedAction DataAction
			switch tt.eventType {
			case resourcepb.WatchEvent_ADDED:
				expectedAction = DataActionCreated
			case resourcepb.WatchEvent_MODIFIED:
				expectedAction = DataActionUpdated
			case resourcepb.WatchEvent_DELETED:
				expectedAction = DataActionDeleted
			default:
				t.Fatalf("unexpected event type: %v", tt.eventType)
			}

			dataKey := DataKey{
				Namespace:       "default",
				Group:           "apps",
				Resource:        "resources",
				Name:            "test-resource",
				ResourceVersion: rv,
				Action:          expectedAction,
			}

			dataReader, err := backend.dataStore.Get(ctx, dataKey)
			require.NoError(t, err)
			dataValue, err := io.ReadAll(dataReader)
			require.NoError(t, err)
			require.NoError(t, dataReader.Close())
			assert.Equal(t, objectToJSONBytes(t, testObj), dataValue)

			// Verify metadata was written to metaStore
			metaKey := MetaDataKey{
				Namespace:       "default",
				Group:           "apps",
				Resource:        "resources",
				Name:            "test-resource",
				ResourceVersion: rv,
				Action:          expectedAction,
				Folder:          "",
			}

			m, err := backend.metaStore.Get(ctx, metaKey)
			require.NoError(t, err)
			require.NotNil(t, m)
			require.Equal(t, "test-resource", m.Key.Name)
			require.Equal(t, "default", m.Key.Namespace)
			require.Equal(t, "apps", m.Key.Group)
			require.Equal(t, "resources", m.Key.Resource)

			// Verify event was written to eventStore
			eventKey := EventKey{
				Namespace:       "default",
				Group:           "apps",
				Resource:        "resources",
				Name:            "test-resource",
				ResourceVersion: rv,
			}

			_, err = backend.eventStore.Get(ctx, eventKey)
			require.NoError(t, err)
		})
	}
}

func TestKvStorageBackend_WriteEvent_ResourceAlreadyExists(t *testing.T) {
	backend := setupTestStorageBackend(t)
	ctx := context.Background()

	// Create a test resource first
	testObj, err := createTestObject()
	require.NoError(t, err)

	metaAccessor, err := utils.MetaAccessor(testObj)
	require.NoError(t, err)

	writeEvent := WriteEvent{
		Type: resourcepb.WatchEvent_ADDED,
		Key: &resourcepb.ResourceKey{
			Namespace: "default",
			Group:     "apps",
			Resource:  "resources",
			Name:      "test-resource",
		},
		Value:      objectToJSONBytes(t, testObj),
		Object:     metaAccessor,
		PreviousRV: 0,
	}

	// First create should succeed
	rv1, err := backend.WriteEvent(ctx, writeEvent)
	require.NoError(t, err)
	require.Greater(t, rv1, int64(0))

	// Try to create the same resource again - should fail with ErrResourceAlreadyExists
	writeEvent.PreviousRV = 0 // Reset previous RV to simulate a fresh create attempt
	rv2, err := backend.WriteEvent(ctx, writeEvent)
	require.Error(t, err)
	require.Equal(t, int64(0), rv2)
	require.ErrorIs(t, err, ErrResourceAlreadyExists)
}

func TestKvStorageBackend_ReadResource_Success(t *testing.T) {
	backend := setupTestStorageBackend(t)
	ctx := context.Background()

	// First, write a resource to read
	testObj, rv := createAndWriteTestObject(t, backend)

	// Now test reading the resource
	readReq := &resourcepb.ReadRequest{
		Key: &resourcepb.ResourceKey{
			Namespace: "default",
			Group:     "apps",
			Resource:  "resources",
			Name:      "test-resource",
		},
		ResourceVersion: 0, // Read latest version
	}

	response := backend.ReadResource(ctx, readReq)
	require.Nil(t, response.Error, "ReadResource should succeed")
	require.NotNil(t, response.Key, "Response should have a key")
	require.Equal(t, "test-resource", response.Key.Name)
	require.Equal(t, "default", response.Key.Namespace)
	require.Equal(t, "apps", response.Key.Group)
	require.Equal(t, "resources", response.Key.Resource)
	require.Equal(t, rv, response.ResourceVersion)
	require.Equal(t, objectToJSONBytes(t, testObj), response.Value)
}

func TestKvStorageBackend_ReadResource_SpecificVersion(t *testing.T) {
	backend := setupTestStorageBackend(t)
	ctx := context.Background()

	// Create initial version
	testObj, rv1 := createAndWriteTestObject(t, backend)

	// Update the resource
	testObj.Object["spec"].(map[string]any)["value"] = "updated data"
	rv2, err := writeObject(t, backend, testObj, resourcepb.WatchEvent_MODIFIED, rv1)
	require.NoError(t, err)

	// Read the first version specifically
	readReq := &resourcepb.ReadRequest{
		Key: &resourcepb.ResourceKey{
			Namespace: "default",
			Group:     "apps",
			Resource:  "resources",
			Name:      "test-resource",
		},
		ResourceVersion: rv1,
	}

	response := backend.ReadResource(ctx, readReq)
	require.Nil(t, response.Error, "ReadResource should succeed for specific version")
	require.Equal(t, rv1, response.ResourceVersion)

	// Verify we got the original data, not the updated data
	originalObj, err := createTestObject()
	require.NoError(t, err)
	require.Equal(t, objectToJSONBytes(t, originalObj), response.Value)

	// Read the latest version
	readReq.ResourceVersion = 0
	response = backend.ReadResource(ctx, readReq)
	require.Nil(t, response.Error, "ReadResource should succeed for latest version")
	require.Equal(t, rv2, response.ResourceVersion)
	require.Equal(t, objectToJSONBytes(t, testObj), response.Value)
}

func TestKvStorageBackend_ReadResource_NotFound(t *testing.T) {
	backend := setupTestStorageBackend(t)
	ctx := context.Background()

	readReq := &resourcepb.ReadRequest{
		Key: &resourcepb.ResourceKey{
			Namespace: "default",
			Group:     "apps",
			Resource:  "resources",
			Name:      "nonexistent-resource",
		},
		ResourceVersion: 0,
	}

	response := backend.ReadResource(ctx, readReq)
	require.NotNil(t, response.Error, "ReadResource should return error for nonexistent resource")
	require.Equal(t, int32(404), response.Error.Code)
	require.Equal(t, "not found", response.Error.Message)
	require.Nil(t, response.Key)
	require.Equal(t, int64(0), response.ResourceVersion)
	require.Nil(t, response.Value)
}

func TestKvStorageBackend_ReadResource_MissingKey(t *testing.T) {
	backend := setupTestStorageBackend(t)
	ctx := context.Background()

	readReq := &resourcepb.ReadRequest{
		Key:             nil, // Missing key
		ResourceVersion: 0,
	}

	response := backend.ReadResource(ctx, readReq)
	require.NotNil(t, response.Error, "ReadResource should return error for missing key")
	require.Equal(t, int32(400), response.Error.Code)
	require.Equal(t, "missing key", response.Error.Message)
	require.Nil(t, response.Key)
	require.Equal(t, int64(0), response.ResourceVersion)
	require.Nil(t, response.Value)
}

func TestKvStorageBackend_ReadResource_DeletedResource(t *testing.T) {
	backend := setupTestStorageBackend(t)
	ctx := context.Background()

	// First, create a resource
	testObj, rv1 := createAndWriteTestObject(t, backend)

	// Delete the resource
	_, err := writeObject(t, backend, testObj, resourcepb.WatchEvent_DELETED, rv1)
	require.NoError(t, err)

	// Try to read the latest version (should be deleted and return not found)
	readReq := &resourcepb.ReadRequest{
		Key: &resourcepb.ResourceKey{
			Namespace: "default",
			Group:     "apps",
			Resource:  "resources",
			Name:      "test-resource",
		},
		ResourceVersion: 0,
	}

	response := backend.ReadResource(ctx, readReq)
	require.NotNil(t, response.Error, "ReadResource should return not found for deleted resource")
	require.Equal(t, int32(404), response.Error.Code)
	require.Equal(t, "not found", response.Error.Message)

	// Try to read the original version (should still work)
	readReq.ResourceVersion = rv1
	response = backend.ReadResource(ctx, readReq)
	require.Nil(t, response.Error, "ReadResource should succeed for specific version before deletion")
	require.Equal(t, rv1, response.ResourceVersion)
	require.Equal(t, objectToJSONBytes(t, testObj), response.Value)
}

func TestKvStorageBackend_ListIterator_Success(t *testing.T) {
	backend := setupTestStorageBackend(t)
	ctx := context.Background()

	// Create multiple test resources
	resources := []struct {
		name  string
		group string
		value string
	}{
		{"resource-1", "apps", "data-1"},
		{"resource-2", "apps", "data-2"},
		{"resource-3", "core", "data-3"},
	}

	for _, res := range resources {
		testObj, err := createTestObjectWithName(res.name, res.group, res.value)
		require.NoError(t, err)

		metaAccessor, err := utils.MetaAccessor(testObj)
		require.NoError(t, err)

		writeEvent := WriteEvent{
			Type: resourcepb.WatchEvent_ADDED,
			Key: &resourcepb.ResourceKey{
				Namespace: "default",
				Group:     res.group,
				Resource:  "resources",
				Name:      res.name,
			},
			Value:      objectToJSONBytes(t, testObj),
			Object:     metaAccessor,
			PreviousRV: 0,
		}

		_, err = backend.WriteEvent(ctx, writeEvent)
		require.NoError(t, err)
	}

	// Test listing all resources in "apps" group
	listReq := &resourcepb.ListRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: "default",
				Group:     "apps",
				Resource:  "resources",
			},
		},
		Limit: 10,
	}

	var collectedItems []struct {
		name            string
		namespace       string
		resourceVersion int64
		value           []byte
	}

	rv, err := backend.ListIterator(ctx, listReq, func(iter ListIterator) error {
		for iter.Next() {
			if err := iter.Error(); err != nil {
				return err
			}
			collectedItems = append(collectedItems, struct {
				name            string
				namespace       string
				resourceVersion int64
				value           []byte
			}{
				name:            iter.Name(),
				namespace:       iter.Namespace(),
				resourceVersion: iter.ResourceVersion(),
				value:           iter.Value(),
			})
		}
		return iter.Error()
	})

	require.NoError(t, err)
	require.Greater(t, rv, int64(0))
	require.Len(t, collectedItems, 2) // Only resources in "apps" group

	// Verify the items contain expected data
	names := make([]string, len(collectedItems))
	for i, item := range collectedItems {
		names[i] = item.name
		require.Equal(t, "default", item.namespace)
		require.Greater(t, item.resourceVersion, int64(0))
		require.NotEmpty(t, item.value)
	}
	require.Equal(t, []string{"resource-1", "resource-2"}, names)
}

func TestKvStorageBackend_ListIterator_WithPagination(t *testing.T) {
	backend := setupTestStorageBackend(t)
	ctx := context.Background()

	// Create multiple test resources
	for i := 1; i <= 5; i++ {
		testObj, err := createTestObjectWithName(fmt.Sprintf("resource-%d", i), "apps", fmt.Sprintf("data-%d", i))
		require.NoError(t, err)

		metaAccessor, err := utils.MetaAccessor(testObj)
		require.NoError(t, err)

		writeEvent := WriteEvent{
			Type: resourcepb.WatchEvent_ADDED,
			Key: &resourcepb.ResourceKey{
				Namespace: "default",
				Group:     "apps",
				Resource:  "resources",
				Name:      fmt.Sprintf("resource-%d", i),
			},
			Value:      objectToJSONBytes(t, testObj),
			Object:     metaAccessor,
			PreviousRV: 0,
		}

		_, err = backend.WriteEvent(ctx, writeEvent)
		require.NoError(t, err)
	}

	// First page with limit 2
	listReq := &resourcepb.ListRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: "default",
				Group:     "apps",
				Resource:  "resources",
			},
		},
		Limit: 2,
	}

	var firstPageItems []string
	var continueToken string

	rv, err := backend.ListIterator(ctx, listReq, func(iter ListIterator) error {
		count := 0
		for iter.Next() {
			if err := iter.Error(); err != nil {
				return err
			}
			firstPageItems = append(firstPageItems, iter.Name())
			count++
			// Simulate pagination by getting continue token after limit items
			if count >= int(listReq.Limit) {
				continueToken = iter.ContinueToken()
				break
			}
		}
		return iter.Error()
	})

	require.NoError(t, err)
	require.Greater(t, rv, int64(0))
	require.Len(t, firstPageItems, 2)
	require.Equal(t, []string{"resource-1", "resource-2"}, firstPageItems)
	require.NotEmpty(t, continueToken)

	// Second page using continue token
	listReq.NextPageToken = continueToken
	var secondPageItems []string
	var continueToken2 string

	_, err = backend.ListIterator(ctx, listReq, func(iter ListIterator) error {
		for iter.Next() {
			if err := iter.Error(); err != nil {
				return err
			}
			secondPageItems = append(secondPageItems, iter.Name())
		}
		// Capture continue token for potential third page
		continueToken2 = iter.ContinueToken()
		return iter.Error()
	})
	// TODO: fix the ListIterator to respect the limit. This require a change to the resource server.
	require.NoError(t, err)
	require.Equal(t, 3, len(secondPageItems))
	require.Equal(t, []string{"resource-3", "resource-4", "resource-5"}, secondPageItems)
	require.NotEmpty(t, continueToken2)
}
func TestKvStorageBackend_ListIterator_EmptyResult(t *testing.T) {
	backend := setupTestStorageBackend(t)
	ctx := context.Background()

	listReq := &resourcepb.ListRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: "nonexistent",
				Group:     "apps",
				Resource:  "resources",
			},
		},
		Limit: 10,
	}

	var collectedItems []string
	rv, err := backend.ListIterator(ctx, listReq, func(iter ListIterator) error {
		for iter.Next() {
			if err := iter.Error(); err != nil {
				return err
			}
			collectedItems = append(collectedItems, iter.Name())
		}
		return iter.Error()
	})

	require.NoError(t, err)
	require.Greater(t, rv, int64(0))
	require.Empty(t, collectedItems)
}

func TestKvStorageBackend_ListIterator_MissingOptions(t *testing.T) {
	backend := setupTestStorageBackend(t)
	ctx := context.Background()

	tests := []struct {
		name    string
		request *resourcepb.ListRequest
	}{
		{
			name: "nil options",
			request: &resourcepb.ListRequest{
				Options: nil,
				Limit:   10,
			},
		},
		{
			name: "nil key",
			request: &resourcepb.ListRequest{
				Options: &resourcepb.ListOptions{
					Key: nil,
				},
				Limit: 10,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := backend.ListIterator(ctx, tt.request, func(iter ListIterator) error {
				return nil
			})
			require.Error(t, err)
			require.Contains(t, err.Error(), "missing options or key")
		})
	}
}

func TestKvStorageBackend_ListIterator_InvalidContinueToken(t *testing.T) {
	backend := setupTestStorageBackend(t)
	ctx := context.Background()

	listReq := &resourcepb.ListRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: "default",
				Group:     "apps",
				Resource:  "resources",
			},
		},
		Limit:         10,
		NextPageToken: "invalid-token",
	}

	_, err := backend.ListIterator(ctx, listReq, func(iter ListIterator) error {
		return nil
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "invalid continue token")
}

func TestKvStorageBackend_ListIterator_SpecificResourceVersion(t *testing.T) {
	backend := setupTestStorageBackend(t)
	ctx := context.Background()

	// Create a resource
	testObj, err := createTestObjectWithName("test-resource", "apps", "initial-data")
	require.NoError(t, err)

	metaAccessor, err := utils.MetaAccessor(testObj)
	require.NoError(t, err)

	writeEvent := WriteEvent{
		Type: resourcepb.WatchEvent_ADDED,
		Key: &resourcepb.ResourceKey{
			Namespace: "default",
			Group:     "apps",
			Resource:  "resources",
			Name:      "test-resource",
		},
		Value:      objectToJSONBytes(t, testObj),
		Object:     metaAccessor,
		PreviousRV: 0,
	}

	rv1, err := backend.WriteEvent(ctx, writeEvent)
	require.NoError(t, err)

	// Update the resource
	testObj.Object["spec"].(map[string]any)["value"] = "updated-data"
	writeEvent.Type = resourcepb.WatchEvent_MODIFIED
	writeEvent.Value = objectToJSONBytes(t, testObj)
	writeEvent.PreviousRV = rv1

	_, err = backend.WriteEvent(ctx, writeEvent)
	require.NoError(t, err)

	// List at specific resource version
	listReq := &resourcepb.ListRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: "default",
				Group:     "apps",
				Resource:  "resources",
			},
		},
		ResourceVersion: rv1,
		Limit:           10,
	}

	var collectedItems [][]byte
	rv, err := backend.ListIterator(ctx, listReq, func(iter ListIterator) error {
		for iter.Next() {
			if err := iter.Error(); err != nil {
				return err
			}
			collectedItems = append(collectedItems, iter.Value())
		}
		return iter.Error()
	})

	require.NoError(t, err)
	require.Equal(t, rv1, rv)
	require.Len(t, collectedItems, 1)

	// Verify we got the original data, not the updated data
	originalObj, err := createTestObjectWithName("test-resource", "apps", "initial-data")
	require.NoError(t, err)
	require.Equal(t, objectToJSONBytes(t, originalObj), collectedItems[0])
}

func TestKvStorageBackend_ListHistory_Success(t *testing.T) {
	backend := setupTestStorageBackend(t)
	ctx := context.Background()

	// Create initial resource
	testObj, err := createTestObjectWithName("test-resource", "apps", "initial-data")
	require.NoError(t, err)

	metaAccessor, err := utils.MetaAccessor(testObj)
	require.NoError(t, err)

	writeEvent := WriteEvent{
		Type: resourcepb.WatchEvent_ADDED,
		Key: &resourcepb.ResourceKey{
			Namespace: "default",
			Group:     "apps",
			Resource:  "resources",
			Name:      "test-resource",
		},
		Value:      objectToJSONBytes(t, testObj),
		Object:     metaAccessor,
		PreviousRV: 0,
	}

	rv1, err := backend.WriteEvent(ctx, writeEvent)
	require.NoError(t, err)

	// Update the resource
	testObj.Object["spec"].(map[string]any)["value"] = "updated-data"
	writeEvent.Type = resourcepb.WatchEvent_MODIFIED
	writeEvent.Value = objectToJSONBytes(t, testObj)
	writeEvent.PreviousRV = rv1

	rv2, err := backend.WriteEvent(ctx, writeEvent)
	require.NoError(t, err)

	// Update again
	testObj.Object["spec"].(map[string]any)["value"] = "final-data"
	writeEvent.Value = objectToJSONBytes(t, testObj)
	writeEvent.PreviousRV = rv2

	rv3, err := backend.WriteEvent(ctx, writeEvent)
	require.NoError(t, err)

	// List the history
	listReq := &resourcepb.ListRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: "default",
				Group:     "apps",
				Resource:  "resources",
				Name:      "test-resource",
			},
		},
		Source: resourcepb.ListRequest_HISTORY,
		Limit:  10,
	}

	var historyItems []struct {
		resourceVersion int64
		value           []byte
	}

	rv, err := backend.ListHistory(ctx, listReq, func(iter ListIterator) error {
		for iter.Next() {
			if err := iter.Error(); err != nil {
				return err
			}
			historyItems = append(historyItems, struct {
				resourceVersion int64
				value           []byte
			}{
				resourceVersion: iter.ResourceVersion(),
				value:           iter.Value(),
			})
		}
		return iter.Error()
	})

	require.NoError(t, err)
	require.Greater(t, rv, int64(0))
	require.Len(t, historyItems, 3) // Should have all 3 versions

	// Verify the history is sorted (newest first by default)
	require.Equal(t, rv3, historyItems[0].resourceVersion)
	require.Equal(t, rv2, historyItems[1].resourceVersion)
	require.Equal(t, rv1, historyItems[2].resourceVersion)

	// Verify the content matches expectations for all versions
	finalObj, err := createTestObjectWithName("test-resource", "apps", "final-data")
	require.NoError(t, err)
	require.Equal(t, objectToJSONBytes(t, finalObj), historyItems[0].value)

	updatedObj, err := createTestObjectWithName("test-resource", "apps", "updated-data")
	require.NoError(t, err)
	require.Equal(t, objectToJSONBytes(t, updatedObj), historyItems[1].value)

	initialObj, err := createTestObjectWithName("test-resource", "apps", "initial-data")
	require.NoError(t, err)
	require.Equal(t, objectToJSONBytes(t, initialObj), historyItems[2].value)
}

func TestKvStorageBackend_ListTrash_Success(t *testing.T) {
	backend := setupTestStorageBackend(t)
	ctx := context.Background()

	// Create a resource
	testObj, err := createTestObjectWithName("test-resource", "apps", "test-data")
	require.NoError(t, err)

	metaAccessor, err := utils.MetaAccessor(testObj)
	require.NoError(t, err)

	writeEvent := WriteEvent{
		Type: resourcepb.WatchEvent_ADDED,
		Key: &resourcepb.ResourceKey{
			Namespace: "default",
			Group:     "apps",
			Resource:  "resources",
			Name:      "test-resource",
		},
		Value:      objectToJSONBytes(t, testObj),
		Object:     metaAccessor,
		PreviousRV: 0,
	}

	rv1, err := backend.WriteEvent(ctx, writeEvent)
	require.NoError(t, err)

	// Delete the resource
	writeEvent.Type = resourcepb.WatchEvent_DELETED
	writeEvent.PreviousRV = rv1
	writeEvent.Object = metaAccessor
	writeEvent.ObjectOld = metaAccessor

	rv2, err := backend.WriteEvent(ctx, writeEvent)
	require.NoError(t, err)

	// List the trash (deleted items)
	listReq := &resourcepb.ListRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: "default",
				Group:     "apps",
				Resource:  "resources",
				Name:      "test-resource",
			},
		},
		Source: resourcepb.ListRequest_TRASH,
		Limit:  10,
	}

	var trashItems []struct {
		name            string
		resourceVersion int64
		value           []byte
	}

	rv, err := backend.ListHistory(ctx, listReq, func(iter ListIterator) error {
		for iter.Next() {
			if err := iter.Error(); err != nil {
				return err
			}
			trashItems = append(trashItems, struct {
				name            string
				resourceVersion int64
				value           []byte
			}{
				name:            iter.Name(),
				resourceVersion: iter.ResourceVersion(),
				value:           iter.Value(),
			})
		}
		return iter.Error()
	})

	require.NoError(t, err)
	require.Greater(t, rv, int64(0))
	require.Len(t, trashItems, 1) // Should have the deleted item

	// Verify the trash item
	require.Equal(t, "test-resource", trashItems[0].name)
	require.Equal(t, rv2, trashItems[0].resourceVersion)
	require.Equal(t, objectToJSONBytes(t, testObj), trashItems[0].value)
}

func TestKvStorageBackend_GetResourceStats_Success(t *testing.T) {
	backend := setupTestStorageBackend(t)
	ctx := context.Background()

	// Create resources in different groups and namespaces
	resources := []struct {
		namespace string
		group     string
		resource  string
		name      string
	}{
		{"default", "apps", "resources", "app1"},
		{"default", "apps", "resources", "app2"},
		{"default", "core", "services", "svc1"},
		{"kube-system", "apps", "resources", "system-app"},
		{"kube-system", "core", "configmaps", "config1"},
	}

	for _, res := range resources {
		testObj, err := createTestObjectWithName(res.name, res.group, "test-data")
		require.NoError(t, err)

		metaAccessor, err := utils.MetaAccessor(testObj)
		require.NoError(t, err)

		writeEvent := WriteEvent{
			Type: resourcepb.WatchEvent_ADDED,
			Key: &resourcepb.ResourceKey{
				Namespace: res.namespace,
				Group:     res.group,
				Resource:  res.resource,
				Name:      res.name,
			},
			Value:      objectToJSONBytes(t, testObj),
			Object:     metaAccessor,
			PreviousRV: 0,
		}

		_, err = backend.WriteEvent(ctx, writeEvent)
		require.NoError(t, err)
	}

	// Get stats for default namespace
	stats, err := backend.GetResourceStats(ctx, "default", 0)
	require.NoError(t, err)
	require.Len(t, stats, 2) // Should have stats for 2 resource types in default namespace

	// Verify the stats contain expected resource types
	resourceTypes := make(map[string]int64)
	for _, stat := range stats {
		key := fmt.Sprintf("%s/%s/%s", stat.Namespace, stat.Group, stat.Resource)
		resourceTypes[key] = stat.Count
		require.Greater(t, stat.ResourceVersion, int64(0))
	}

	require.Equal(t, int64(2), resourceTypes["default/apps/resources"])
	require.Equal(t, int64(1), resourceTypes["default/core/services"])

	// Get stats for all namespaces (empty string)
	allStats, err := backend.GetResourceStats(ctx, "", 0)
	require.NoError(t, err)
	require.Len(t, allStats, 4) // Should have stats for all 4 resource types across namespaces

	// Get stats with minCount filter
	filteredStats, err := backend.GetResourceStats(ctx, "", 1)
	require.NoError(t, err)
	require.Len(t, filteredStats, 1) // Only resources in default namespace has count > 1

	require.Equal(t, "default", filteredStats[0].Namespace)
	require.Equal(t, "apps", filteredStats[0].Group)
	require.Equal(t, "resources", filteredStats[0].Resource)
	require.Equal(t, int64(2), filteredStats[0].Count)
}

func TestKvStorageBackend_PruneEvents(t *testing.T) {
	t.Run("will prune oldest events when exceeding limit", func(t *testing.T) {
		backend := setupTestStorageBackend(t)
		ctx := context.Background()

		// Create a resource
		testObj, err := createTestObjectWithName("test-resource", "apps", "test-data")
		require.NoError(t, err)
		metaAccessor, err := utils.MetaAccessor(testObj)
		require.NoError(t, err)
		writeEvent := WriteEvent{
			Type: resourcepb.WatchEvent_ADDED,
			Key: &resourcepb.ResourceKey{
				Namespace: "default",
				Group:     "apps",
				Resource:  "resources",
				Name:      "test-resource",
			},
			Value:      objectToJSONBytes(t, testObj),
			Object:     metaAccessor,
			PreviousRV: 0,
		}
		rv1, err := backend.WriteEvent(ctx, writeEvent)
		require.NoError(t, err)

		// Update the resource prunerMaxEvents times. This will create one more event than the pruner limit.
		previousRV := rv1
		for i := 0; i < prunerMaxEvents; i++ {
			testObj.Object["spec"].(map[string]any)["value"] = fmt.Sprintf("update-%d", i)
			writeEvent.Type = resourcepb.WatchEvent_MODIFIED
			writeEvent.Value = objectToJSONBytes(t, testObj)
			writeEvent.PreviousRV = previousRV
			newRv, err := backend.WriteEvent(ctx, writeEvent)
			require.NoError(t, err)
			previousRV = newRv
		}

		pruningKey := PruningKey{
			Namespace: "default",
			Group:     "apps",
			Resource:  "resources",
			Name:      "test-resource",
		}

		err = backend.pruneEvents(ctx, pruningKey)
		require.NoError(t, err)

		// Verify the first event has been pruned (rv1)
		eventKey1 := DataKey{
			Namespace:       "default",
			Group:           "apps",
			Resource:        "resources",
			Name:            "test-resource",
			ResourceVersion: rv1,
		}

		_, err = backend.dataStore.Get(ctx, eventKey1)
		require.Error(t, err) // Should return error as event is pruned

		// assert prunerMaxEvents most recent events exist
		counter := 0
		for datakey, err := range backend.dataStore.Keys(ctx, ListRequestKey{
			Namespace: "default",
			Group:     "apps",
			Resource:  "resources",
			Name:      "test-resource",
		}) {
			require.NoError(t, err)
			require.NotEqual(t, rv1, datakey.ResourceVersion)
			counter++
		}
		require.Equal(t, prunerMaxEvents, counter)
	})

	t.Run("will not prune events when less than limit", func(t *testing.T) {
		backend := setupTestStorageBackend(t)
		ctx := context.Background()

		// Create a resource
		testObj, err := createTestObjectWithName("test-resource", "apps", "test-data")
		require.NoError(t, err)
		metaAccessor, err := utils.MetaAccessor(testObj)
		require.NoError(t, err)
		writeEvent := WriteEvent{
			Type: resourcepb.WatchEvent_ADDED,
			Key: &resourcepb.ResourceKey{
				Namespace: "default",
				Group:     "apps",
				Resource:  "resources",
				Name:      "test-resource",
			},
			Value:      objectToJSONBytes(t, testObj),
			Object:     metaAccessor,
			PreviousRV: 0,
		}
		rv1, err := backend.WriteEvent(ctx, writeEvent)
		require.NoError(t, err)

		// Update the resource prunerMaxEvents-1 times. This will create same number of events as the pruner limit.
		previousRV := rv1
		for i := 0; i < prunerMaxEvents-1; i++ {
			testObj.Object["spec"].(map[string]any)["value"] = fmt.Sprintf("update-%d", i)
			writeEvent.Type = resourcepb.WatchEvent_MODIFIED
			writeEvent.Value = objectToJSONBytes(t, testObj)
			writeEvent.PreviousRV = previousRV
			newRv, err := backend.WriteEvent(ctx, writeEvent)
			require.NoError(t, err)
			previousRV = newRv
		}

		pruningKey := PruningKey{
			Namespace: "default",
			Group:     "apps",
			Resource:  "resources",
			Name:      "test-resource",
		}

		err = backend.pruneEvents(ctx, pruningKey)
		require.NoError(t, err)

		// assert all events exist
		counter := 0
		for _, err := range backend.dataStore.Keys(ctx, ListRequestKey{
			Namespace: "default",
			Group:     "apps",
			Resource:  "resources",
			Name:      "test-resource",
		}) {
			require.NoError(t, err)
			counter++
		}
		require.Equal(t, prunerMaxEvents, counter)
	})
}

// createTestObject creates a test unstructured object with standard values
func createTestObject() (*unstructured.Unstructured, error) {
	return createTestObjectWithName("test-resource", "apps", "test data")
}

// objectToJSONBytes converts an unstructured object to JSON bytes
func objectToJSONBytes(t *testing.T, obj *unstructured.Unstructured) []byte {
	jsonBytes, err := obj.MarshalJSON()
	require.NoError(t, err)
	return jsonBytes
}

// createTestObjectWithName creates a test unstructured object with specific name, group and value
func createTestObjectWithName(name, group, value string) (*unstructured.Unstructured, error) {
	u := &unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": group + "/v1",
			"kind":       "resource",
			"metadata": map[string]any{
				"name":      name,
				"namespace": "default",
			},
			"spec": map[string]any{
				"value": value,
			},
		},
	}
	return u, nil
}

// writeObject writes an unstructured object to the backend using the provided event type and previous resource version
func writeObject(t *testing.T, backend *kvStorageBackend, obj *unstructured.Unstructured, eventType resourcepb.WatchEvent_Type, previousRV int64) (int64, error) {
	metaAccessor, err := utils.MetaAccessor(obj)
	require.NoError(t, err)

	// Extract resource information from the object
	namespace := metaAccessor.GetNamespace()
	if namespace == "" {
		namespace = "default"
	}

	// Extract group from apiVersion (e.g., "apps/v1" -> "apps")
	apiVersion := obj.GetAPIVersion()
	group := ""
	if parts := strings.Split(apiVersion, "/"); len(parts) > 1 {
		group = parts[0]
	}

	// Use standard resource type for tests
	resource := "resources"
	if group == "core" {
		resource = "services"
	}

	writeEvent := WriteEvent{
		Type: eventType,
		Key: &resourcepb.ResourceKey{
			Namespace: namespace,
			Group:     group,
			Resource:  resource,
			Name:      metaAccessor.GetName(),
		},
		Value:      objectToJSONBytes(t, obj),
		Object:     metaAccessor,
		ObjectOld:  metaAccessor,
		PreviousRV: previousRV,
	}
	if eventType == resourcepb.WatchEvent_ADDED {
		writeEvent.ObjectOld = nil
	}

	return backend.WriteEvent(context.Background(), writeEvent)
}

// createAndWriteTestObject creates a basic test object and writes it to the backend
func createAndWriteTestObject(t *testing.T, backend *kvStorageBackend) (*unstructured.Unstructured, int64) {
	testObj, err := createTestObject()
	require.NoError(t, err)

	rv, err := writeObject(t, backend, testObj, resourcepb.WatchEvent_ADDED, 0)
	require.NoError(t, err)

	return testObj, rv
}
