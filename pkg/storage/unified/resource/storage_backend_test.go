package resource

import (
	"context"
	"fmt"
	"io"
	"math/rand/v2"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var appsNamespace = NamespacedResource{
	Namespace: "default",
	Group:     "apps",
	Resource:  "resource",
}

func withChannelNotifier(opts *KVBackendOptions) {
	opts.UseChannelNotifier = true
}

func setupTestStorageBackend(t *testing.T, configs ...func(*KVBackendOptions)) *kvStorageBackend {
	kv := setupBadgerKV(t)
	opts := KVBackendOptions{
		KvStore:    kv,
		WithPruner: true,
	}

	for _, cfg := range configs {
		cfg(&opts)
	}

	backend, err := NewKVStorageBackend(opts)
	kvBackend := backend.(*kvStorageBackend)
	require.NoError(t, err)
	return kvBackend
}

func setupTestStorageBackendWithClusterScope(t *testing.T) *kvStorageBackend {
	kv := setupBadgerKV(t)
	opts := KVBackendOptions{
		KvStore:                      kv,
		WithPruner:                   true,
		WithExperimentalClusterScope: true,
	}
	backend, err := NewKVStorageBackend(opts)
	kvBackend := backend.(*kvStorageBackend)
	require.NoError(t, err)
	return kvBackend
}

func TestNewKvStorageBackend(t *testing.T) {
	backend := setupTestStorageBackend(t)

	assert.NotNil(t, backend)
	assert.NotNil(t, backend.kv)
	assert.NotNil(t, backend.dataStore)

	assert.NotNil(t, backend.eventStore)
	assert.NotNil(t, backend.notifier)
	assert.NotNil(t, backend.snowflake)
}

func TestKvStorageBackend_WriteEvent_Success(t *testing.T) {
	backend := setupTestStorageBackend(t)
	ctx := context.Background()

	testObj, err := createTestObject()
	require.NoError(t, err)

	metaAccessor, err := utils.MetaAccessor(testObj)
	require.NoError(t, err)

	resourceName := "test-resource"

	// Step 1: Create the resource (ADDED event)
	addEvent := WriteEvent{
		Type: resourcepb.WatchEvent_ADDED,
		Key: &resourcepb.ResourceKey{
			Namespace: "default",
			Group:     "apps",
			Resource:  "resources",
			Name:      resourceName,
		},
		Value:      objectToJSONBytes(t, testObj),
		Object:     metaAccessor,
		ObjectOld:  metaAccessor,
		PreviousRV: 0,
	}

	rv1, err := backend.WriteEvent(ctx, addEvent)
	require.NoError(t, err)
	assert.Greater(t, rv1, int64(0), "resource version should be positive")

	// Verify ADDED event was written to dataStore
	dataKey1 := DataKey{
		Namespace:       "default",
		Group:           "apps",
		Resource:        "resources",
		Name:            resourceName,
		ResourceVersion: rv1,
		Action:          DataActionCreated,
	}

	dataReader1, err := backend.dataStore.Get(ctx, dataKey1)
	require.NoError(t, err)
	dataValue1, err := io.ReadAll(dataReader1)
	require.NoError(t, err)
	require.NoError(t, dataReader1.Close())
	assert.Equal(t, objectToJSONBytes(t, testObj), dataValue1)

	// Verify ADDED event was written to eventStore
	eventKey1 := EventKey{
		Namespace:       "default",
		Group:           "apps",
		Resource:        "resources",
		Name:            resourceName,
		ResourceVersion: rv1,
		Action:          DataActionCreated,
	}

	_, err = backend.eventStore.Get(ctx, eventKey1)
	require.NoError(t, err)

	// Step 2: Update the resource (MODIFIED event)
	modifyEvent := WriteEvent{
		Type: resourcepb.WatchEvent_MODIFIED,
		Key: &resourcepb.ResourceKey{
			Namespace: "default",
			Group:     "apps",
			Resource:  "resources",
			Name:      resourceName,
		},
		Value:      objectToJSONBytes(t, testObj),
		Object:     metaAccessor,
		ObjectOld:  metaAccessor,
		PreviousRV: rv1,
	}

	rv2, err := backend.WriteEvent(ctx, modifyEvent)
	require.NoError(t, err)
	assert.Greater(t, rv2, rv1, "updated resource version should be greater")

	// Verify MODIFIED event was written to dataStore
	dataKey2 := DataKey{
		Namespace:       "default",
		Group:           "apps",
		Resource:        "resources",
		Name:            resourceName,
		ResourceVersion: rv2,
		Action:          DataActionUpdated,
	}

	dataReader2, err := backend.dataStore.Get(ctx, dataKey2)
	require.NoError(t, err)
	dataValue2, err := io.ReadAll(dataReader2)
	require.NoError(t, err)
	require.NoError(t, dataReader2.Close())
	assert.Equal(t, objectToJSONBytes(t, testObj), dataValue2)

	// Verify MODIFIED event was written to eventStore
	eventKey2 := EventKey{
		Namespace:       "default",
		Group:           "apps",
		Resource:        "resources",
		Name:            resourceName,
		ResourceVersion: rv2,
		Action:          DataActionUpdated,
	}

	_, err = backend.eventStore.Get(ctx, eventKey2)
	require.NoError(t, err)

	// Step 3: Delete the resource (DELETED event)
	deleteEvent := WriteEvent{
		Type: resourcepb.WatchEvent_DELETED,
		Key: &resourcepb.ResourceKey{
			Namespace: "default",
			Group:     "apps",
			Resource:  "resources",
			Name:      resourceName,
		},
		Value:      objectToJSONBytes(t, testObj),
		Object:     metaAccessor,
		ObjectOld:  metaAccessor,
		PreviousRV: rv2,
	}

	rv3, err := backend.WriteEvent(ctx, deleteEvent)
	require.NoError(t, err)
	assert.Greater(t, rv3, rv2, "deleted resource version should be greater")

	// Verify DELETED event was written to dataStore
	dataKey3 := DataKey{
		Namespace:       "default",
		Group:           "apps",
		Resource:        "resources",
		Name:            resourceName,
		ResourceVersion: rv3,
		Action:          DataActionDeleted,
	}

	dataReader3, err := backend.dataStore.Get(ctx, dataKey3)
	require.NoError(t, err)
	dataValue3, err := io.ReadAll(dataReader3)
	require.NoError(t, err)
	require.NoError(t, dataReader3.Close())
	assert.Equal(t, objectToJSONBytes(t, testObj), dataValue3)

	// Verify DELETED event was written to eventStore
	eventKey3 := EventKey{
		Namespace:       "default",
		Group:           "apps",
		Resource:        "resources",
		Name:            resourceName,
		ResourceVersion: rv3,
		Action:          DataActionDeleted,
	}

	_, err = backend.eventStore.Get(ctx, eventKey3)
	require.NoError(t, err)
}

func TestKvStorageBackend_WatchWriteEvents(t *testing.T) {
	for _, useChannel := range []bool{true, false} {
		backend := setupTestStorageBackend(t)
		name := "pollingNotifier"

		if useChannel {
			backend = setupTestStorageBackend(t, withChannelNotifier)
			name = "channelNotifier"
		}

		t.Run(name, func(t *testing.T) {
			ctx, stop := context.WithTimeout(t.Context(), 3*time.Second)
			defer stop()

			testObj, err := createTestObject()
			require.NoError(t, err)

			metaAccessor, err := utils.MetaAccessor(testObj)
			require.NoError(t, err)

			resourceName := "test-resource"

			// Start watching for events before creating resources
			stream, err := backend.WatchWriteEvents(ctx)
			require.NoError(t, err)

			events := make([]WriteEvent, 3)
			rvs := make([]int64, 3)

			// Event 1: Create the resource (ADDED event)
			events[0] = WriteEvent{
				Type: resourcepb.WatchEvent_ADDED,
				Key: &resourcepb.ResourceKey{
					Namespace: "default",
					Group:     "apps",
					Resource:  "resources",
					Name:      resourceName,
				},
				Value:      objectToJSONBytes(t, testObj),
				Object:     metaAccessor,
				ObjectOld:  metaAccessor,
				PreviousRV: 0,
			}

			rvs[0], err = backend.WriteEvent(ctx, events[0])
			require.NoError(t, err)

			// Event 2: Update the resource (MODIFIED event)
			newObject := testObj.DeepCopyObject()
			newMetaAccessor, err := utils.MetaAccessor(newObject)
			require.NoError(t, err)
			newMetaAccessor.SetFolder("abc")

			events[1] = WriteEvent{
				Type: resourcepb.WatchEvent_MODIFIED,
				Key: &resourcepb.ResourceKey{
					Namespace: "default",
					Group:     "apps",
					Resource:  "resources",
					Name:      resourceName,
				},
				Value:      objectToJSONBytes(t, testObj),
				Object:     newMetaAccessor,
				ObjectOld:  metaAccessor,
				PreviousRV: rvs[0],
			}

			rvs[1], err = backend.WriteEvent(ctx, events[1])
			require.NoError(t, err)

			// Event 3: Delete the resource (DELETED event)
			events[2] = WriteEvent{
				Type: resourcepb.WatchEvent_DELETED,
				Key: &resourcepb.ResourceKey{
					Namespace: "default",
					Group:     "apps",
					Resource:  "resources",
					Name:      resourceName,
				},
				Value:      objectToJSONBytes(t, testObj),
				Object:     metaAccessor,
				ObjectOld:  metaAccessor,
				PreviousRV: rvs[1],
			}

			rvs[2], err = backend.WriteEvent(ctx, events[2])
			require.NoError(t, err)

			// Wait for all 3 events
			for j, event := range events {
				select {
				case writtenEvent := <-stream:
					require.Equal(t, event.Key, writtenEvent.Key)
					require.Equal(t, event.Type, writtenEvent.Type)
					require.Equal(t, event.Value, writtenEvent.Value)
					require.Equal(t, event.Object.GetFolder(), writtenEvent.Folder)
					require.Equal(t, rvs[j], writtenEvent.ResourceVersion)

					if j > 0 {
						require.Equal(t, rvs[j-1], writtenEvent.PreviousRV)
					}
				case <-ctx.Done():
					require.FailNow(t, "timed out waiting for events")
				}
			}
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

func TestKvStorageBackend_ReadResource_TooHighResourceVersion(t *testing.T) {
	backend := setupTestStorageBackend(t)
	ctx := context.Background()

	// First, create a resource
	_, rv := createAndWriteTestObject(t, backend)

	// Try to read with a resource version that's way too high
	readReq := &resourcepb.ReadRequest{
		Key: &resourcepb.ResourceKey{
			Namespace: "default",
			Group:     "apps",
			Resource:  "resources",
			Name:      "test-resource",
		},
		ResourceVersion: rv + 1000000000000, // Way in the future
	}

	response := backend.ReadResource(ctx, readReq)
	require.NotNil(t, response.Error, "ReadResource should return error for too high resource version")
	require.Equal(t, int32(504), response.Error.Code) // http.StatusGatewayTimeout
	require.Equal(t, "Timeout", response.Error.Reason)
	require.Equal(t, "ResourceVersion is larger than max", response.Error.Message)
	require.NotNil(t, response.Error.Details)
	require.Len(t, response.Error.Details.Causes, 1)
	require.Equal(t, "ResourceVersionTooLarge", response.Error.Details.Causes[0].Reason)
	require.Contains(t, response.Error.Details.Causes[0].Message, "requested:")
	require.Contains(t, response.Error.Details.Causes[0].Message, "current")
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
		ns := NamespacedResource{
			Group:     res.group,
			Resource:  "resource",
			Namespace: "default",
		}
		testObj, err := createTestObjectWithName(res.name, ns, res.value)
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
		testObj, err := createTestObjectWithName(fmt.Sprintf("resource-%d", i), appsNamespace, fmt.Sprintf("data-%d", i))
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
		count := 0
		for iter.Next() {
			if err := iter.Error(); err != nil {
				return err
			}
			secondPageItems = append(secondPageItems, iter.Name())
			count++
			// Simulate pagination by getting continue token after limit items
			if count >= int(listReq.Limit) {
				continueToken2 = iter.ContinueToken()
				break
			}
		}
		return iter.Error()
	})
	require.NoError(t, err)
	require.Equal(t, 2, len(secondPageItems))
	require.Equal(t, []string{"resource-3", "resource-4"}, secondPageItems)
	require.NotEmpty(t, continueToken2)

	// third page using continue token
	listReq.NextPageToken = continueToken2
	var thirdPageItems []string
	var continueToken3 string

	_, err = backend.ListIterator(ctx, listReq, func(iter ListIterator) error {
		count := 0
		for iter.Next() {
			if err := iter.Error(); err != nil {
				return err
			}
			thirdPageItems = append(thirdPageItems, iter.Name())
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
	require.Equal(t, 1, len(thirdPageItems))
	require.Equal(t, []string{"resource-5"}, thirdPageItems)
	require.Empty(t, continueToken3)
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
	testObj, err := createTestObjectWithName("test-resource", appsNamespace, "initial-data")
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
	originalObj, err := createTestObjectWithName("test-resource", appsNamespace, "initial-data")
	require.NoError(t, err)
	require.Equal(t, objectToJSONBytes(t, originalObj), collectedItems[0])
}

func TestKvStorageBackend_ListModifiedSince(t *testing.T) {
	backend := setupTestStorageBackend(t)
	ctx := context.Background()

	ns := NamespacedResource{
		Namespace: "default",
		Group:     "apps",
		Resource:  "resources",
	}

	expectations := seedBackend(t, backend, ctx, ns)
	for _, expectation := range expectations {
		_, seq := backend.ListModifiedSince(ctx, ns, expectation.rv)

		for mr, err := range seq {
			require.NoError(t, err)
			require.Equal(t, mr.Key.Group, ns.Group)
			require.Equal(t, mr.Key.Namespace, ns.Namespace)
			require.Equal(t, mr.Key.Resource, ns.Resource)

			expectedMr, ok := expectation.changes[mr.Key.Name]
			require.True(t, ok, "ListModifiedSince yielded unexpected resource: ", mr.Key.String())
			require.Equal(t, mr.ResourceVersion, expectedMr.ResourceVersion)
			require.Equal(t, mr.Action, expectedMr.Action)
			require.Equal(t, string(mr.Value), string(expectedMr.Value))
			delete(expectation.changes, mr.Key.Name)
		}

		require.Equal(t, 0, len(expectation.changes), "ListModifiedSince failed to return one or more expected items")
	}
}

type expectation struct {
	rv      int64
	changes map[string]*ModifiedResource
}

func randomString() string {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	result := make([]byte, 16)
	for i := range result {
		result[i] = charset[rand.IntN(len(charset))]
	}
	return string(result)
}

func randomStringGenerator() func() string {
	generated := make([]string, 0)
	return func() string {
		var str string
		for str == "" {
			randString := randomString()
			if !slices.Contains(generated, randString) {
				str = randString
			}
		}
		return str
	}
}

// creates 2 hour old snowflake for testing
func generateOldSnowflake(t *testing.T) int64 {
	// Generate a snowflake for 2 hours ago using the snowflakeFromTime utility
	// which properly handles the epoch
	twoHoursAgo := time.Now().Add(-2 * time.Hour)
	return snowflakeFromTime(twoHoursAgo)
}

// seedBackend seeds the kvstore with data and return the expected result for ListModifiedSince calls
func seedBackend(t *testing.T, backend *kvStorageBackend, ctx context.Context, ns NamespacedResource) []expectation {
	uniqueStringGen := randomStringGenerator()
	nsDifferentNamespace := NamespacedResource{
		Namespace: "uaoeueao",
		Group:     ns.Group,
		Resource:  ns.Resource,
	}

	expectations := make([]expectation, 0) //nolint:prealloc
	// initial test will contain the same "changes" as the second one (first one added by the for loop below)
	// this is done with a 2 hour old RV so it uses the event store instead of the data store to check for changes
	expectations = append(expectations, expectation{
		rv:      generateOldSnowflake(t),
		changes: make(map[string]*ModifiedResource),
	})

	for range 100 {
		updates := rand.IntN(5)
		shouldDelete := rand.IntN(100) < 10
		mr := createAndSaveTestObject(t, backend, ctx, ns, uniqueStringGen, updates, shouldDelete)
		expectations = append(expectations, expectation{
			rv:      mr.ResourceVersion,
			changes: make(map[string]*ModifiedResource),
		})

		for _, expect := range expectations {
			expect.changes[mr.Key.Name] = mr
		}

		// also seed data to some random namespace to make sure we won't return this data
		updates = rand.IntN(5)
		shouldDelete = rand.IntN(100) < 10
		_ = createAndSaveTestObject(t, backend, ctx, nsDifferentNamespace, uniqueStringGen, updates, shouldDelete)
	}

	// last test will simulate calling ListModifiedSince with a newer RV than all the updates above
	rv, _ := backend.ListModifiedSince(ctx, ns, 1)
	expectations = append(expectations, expectation{
		rv:      rv,
		changes: make(map[string]*ModifiedResource), // empty
	})

	return expectations
}

func TestKvStorageBackend_ListModifiedSince_WithFolder(t *testing.T) {
	backend := setupTestStorageBackend(t)
	ctx := context.Background()

	// Use a unique resource type to avoid conflicts with other tests
	ns := NamespacedResource{
		Namespace: "test-folder-ns",
		Group:     "test.folder.app",
		Resource:  "test-resources",
	}

	// Create test objects with folder field set
	testObj1, err := createTestObjectWithName("dashboard-1", ns, "data-1")
	require.NoError(t, err)
	metaAccessor1, err := utils.MetaAccessor(testObj1)
	require.NoError(t, err)
	metaAccessor1.SetFolder("folder-abc")

	testObj2, err := createTestObjectWithName("dashboard-2", ns, "data-2")
	require.NoError(t, err)
	metaAccessor2, err := utils.MetaAccessor(testObj2)
	require.NoError(t, err)
	metaAccessor2.SetFolder("folder-xyz")

	// Write first dashboard
	writeEvent1 := WriteEvent{
		Type: resourcepb.WatchEvent_ADDED,
		Key: &resourcepb.ResourceKey{
			Namespace: ns.Namespace,
			Group:     ns.Group,
			Resource:  ns.Resource,
			Name:      "dashboard-1",
		},
		Value:      objectToJSONBytes(t, testObj1),
		Object:     metaAccessor1,
		PreviousRV: 0,
	}
	rv1, err := backend.WriteEvent(ctx, writeEvent1)
	require.NoError(t, err)

	// Write second dashboard
	writeEvent2 := WriteEvent{
		Type: resourcepb.WatchEvent_ADDED,
		Key: &resourcepb.ResourceKey{
			Namespace: ns.Namespace,
			Group:     ns.Group,
			Resource:  ns.Resource,
			Name:      "dashboard-2",
		},
		Value:      objectToJSONBytes(t, testObj2),
		Object:     metaAccessor2,
		PreviousRV: 0,
	}
	rv2, err := backend.WriteEvent(ctx, writeEvent2)
	require.NoError(t, err)

	tests := []struct {
		name     string
		sinceRV  func() int64
		codePath string
	}{
		{
			name:     "via event store (recent RV < 1 hour)",
			sinceRV:  func() int64 { return rv1 - 1 },
			codePath: "listModifiedSinceEventStore",
		},
		{
			name:     "via data store (old RV > 1 hour)",
			sinceRV:  func() int64 { return generateOldSnowflake(t) },
			codePath: "listModifiedSinceDataStore",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sinceRV := tt.sinceRV()

			// List resources
			rv, seq := backend.ListModifiedSince(ctx, ns, sinceRV)

			changes := make(map[string]*ModifiedResource)
			for mr, err := range seq {
				require.NoError(t, err, "Should not get error when Folder field is included")
				require.Equal(t, ns.Group, mr.Key.Group)
				require.Equal(t, ns.Namespace, mr.Key.Namespace)
				require.Equal(t, ns.Resource, mr.Key.Resource)
				changes[mr.Key.Name] = mr
			}

			require.Greater(t, rv, sinceRV)
			require.Len(t, changes, 2, "Should return 2 resources")

			// Verify dashboard-1
			require.Contains(t, changes, "dashboard-1")
			require.Equal(t, rv1, changes["dashboard-1"].ResourceVersion)
			require.Equal(t, objectToJSONBytes(t, testObj1), changes["dashboard-1"].Value)

			// Verify dashboard-2
			require.Contains(t, changes, "dashboard-2")
			require.Equal(t, rv2, changes["dashboard-2"].ResourceVersion)
			require.Equal(t, objectToJSONBytes(t, testObj2), changes["dashboard-2"].Value)
		})
	}
}

func createAndSaveTestObject(t *testing.T, backend *kvStorageBackend, ctx context.Context, ns NamespacedResource, uniqueStringGen func() string, updates int, deleted bool) *ModifiedResource {
	name := uniqueStringGen()
	action := resourcepb.WatchEvent_ADDED
	rv, testObj := addTestObject(t, backend, ctx, ns, name, uniqueStringGen())

	for i := 0; i < updates; i += 1 {
		rv = updateTestObject(t, backend, ctx, testObj, rv, ns, name, uniqueStringGen())
		action = resourcepb.WatchEvent_MODIFIED
	}

	if deleted {
		rv = deleteTestObject(t, backend, ctx, testObj, rv, ns, name)
		action = resourcepb.WatchEvent_DELETED
	}

	value, err := testObj.MarshalJSON()
	require.NoError(t, err)

	return &ModifiedResource{
		Key: resourcepb.ResourceKey{
			Namespace: ns.Namespace,
			Group:     ns.Group,
			Resource:  ns.Resource,
			Name:      name,
		},
		ResourceVersion: rv,
		Action:          action,
		Value:           value,
	}
}

func addTestObject(t *testing.T, backend *kvStorageBackend, ctx context.Context, ns NamespacedResource, name, value string) (int64, *unstructured.Unstructured) {
	testObj, err := createTestObjectWithName(name, ns, value)
	require.NoError(t, err)

	metaAccessor, err := utils.MetaAccessor(testObj)
	require.NoError(t, err)

	writeEvent := WriteEvent{
		Type: resourcepb.WatchEvent_ADDED,
		Key: &resourcepb.ResourceKey{
			Namespace: ns.Namespace,
			Group:     ns.Group,
			Resource:  ns.Resource,
			Name:      name,
		},
		Value:      objectToJSONBytes(t, testObj),
		Object:     metaAccessor,
		PreviousRV: 0,
	}

	rv, err := backend.WriteEvent(ctx, writeEvent)
	require.NoError(t, err)
	return rv, testObj
}

func deleteTestObject(t *testing.T, backend *kvStorageBackend, ctx context.Context, originalObj *unstructured.Unstructured, previousRV int64, ns NamespacedResource, name string) int64 {
	metaAccessor, err := utils.MetaAccessor(originalObj)
	require.NoError(t, err)

	writeEvent := WriteEvent{
		Type: resourcepb.WatchEvent_DELETED,
		Key: &resourcepb.ResourceKey{
			Namespace: ns.Namespace,
			Group:     ns.Group,
			Resource:  ns.Resource,
			Name:      name,
		},
		Value:      objectToJSONBytes(t, originalObj),
		Object:     metaAccessor,
		ObjectOld:  metaAccessor,
		PreviousRV: previousRV,
	}

	rv, err := backend.WriteEvent(ctx, writeEvent)
	require.NoError(t, err)
	return rv
}

func updateTestObject(t *testing.T, backend *kvStorageBackend, ctx context.Context, originalObj *unstructured.Unstructured, previousRV int64, ns NamespacedResource, name, value string) int64 {
	originalObj.Object["spec"].(map[string]any)["value"] = value

	metaAccessor, err := utils.MetaAccessor(originalObj)
	require.NoError(t, err)

	writeEvent := WriteEvent{
		Type: resourcepb.WatchEvent_MODIFIED,
		Key: &resourcepb.ResourceKey{
			Namespace: ns.Namespace,
			Group:     ns.Group,
			Resource:  ns.Resource,
			Name:      name,
		},
		Value:      objectToJSONBytes(t, originalObj),
		Object:     metaAccessor,
		PreviousRV: previousRV,
	}

	rv, err := backend.WriteEvent(ctx, writeEvent)
	require.NoError(t, err)
	return rv
}

func TestKvStorageBackend_ListHistory_Success(t *testing.T) {
	backend := setupTestStorageBackend(t)
	ctx := context.Background()

	// Create initial resource
	testObj, err := createTestObjectWithName("test-resource", appsNamespace, "initial-data")
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
	finalObj, err := createTestObjectWithName("test-resource", appsNamespace, "final-data")
	require.NoError(t, err)
	require.Equal(t, objectToJSONBytes(t, finalObj), historyItems[0].value)

	updatedObj, err := createTestObjectWithName("test-resource", appsNamespace, "updated-data")
	require.NoError(t, err)
	require.Equal(t, objectToJSONBytes(t, updatedObj), historyItems[1].value)

	initialObj, err := createTestObjectWithName("test-resource", appsNamespace, "initial-data")
	require.NoError(t, err)
	require.Equal(t, objectToJSONBytes(t, initialObj), historyItems[2].value)
}

func TestKvStorageBackend_ListTrash_Success(t *testing.T) {
	backend := setupTestStorageBackend(t)
	ctx := context.Background()

	// Create a resource
	testObj, err := createTestObjectWithName("test-resource", appsNamespace, "test-data")
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

	// Do the same for a provisioned object
	provisionedObj, err := createTestObjectWithName("provisioned-obj", appsNamespace, "test-data")
	require.NoError(t, err)
	metaAccessorProvisioned, err := utils.MetaAccessor(provisionedObj)
	require.NoError(t, err)
	metaAccessorProvisioned.SetAnnotation(utils.AnnoKeyManagerKind, "repo")

	writeEventProvisioned := WriteEvent{
		Type: resourcepb.WatchEvent_ADDED,
		Key: &resourcepb.ResourceKey{
			Namespace: "default",
			Group:     "apps",
			Resource:  "resources",
			Name:      "provisioned-obj",
		},
		Value:      objectToJSONBytes(t, provisionedObj),
		Object:     metaAccessorProvisioned,
		PreviousRV: 0,
	}

	rv3, err := backend.WriteEvent(ctx, writeEventProvisioned)
	require.NoError(t, err)

	writeEventProvisioned.Type = resourcepb.WatchEvent_DELETED
	writeEventProvisioned.PreviousRV = rv3
	writeEventProvisioned.Object = metaAccessorProvisioned
	writeEventProvisioned.ObjectOld = metaAccessorProvisioned
	_, err = backend.WriteEvent(ctx, writeEventProvisioned)
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
	require.Len(t, trashItems, 1) // Should have the non-provisioned deleted item

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
		ns := NamespacedResource{
			Group:     res.group,
			Namespace: "default",
			Resource:  "resource",
		}
		testObj, err := createTestObjectWithName(res.name, ns, "test-data")
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
	stats, err := backend.GetResourceStats(ctx, NamespacedResource{Namespace: "default"}, 0)
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
	allStats, err := backend.GetResourceStats(ctx, NamespacedResource{Namespace: ""}, 0)
	require.NoError(t, err)
	require.Len(t, allStats, 4) // Should have stats for all 4 resource types across namespaces

	// Get stats with minCount filter
	filteredStats, err := backend.GetResourceStats(ctx, NamespacedResource{Namespace: ""}, 1)
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
		ns := NamespacedResource{
			Namespace: "default",
			Group:     "apps",
			Resource:  "resources",
		}
		testObj, err := createTestObjectWithName("test-resource", ns, "test-data")
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
		}, SortOrderDesc) {
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
		ns := NamespacedResource{
			Namespace: "default",
			Group:     "apps",
			Resource:  "resources",
		}
		testObj, err := createTestObjectWithName("test-resource", ns, "test-data")
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
		}, SortOrderDesc) {
			require.NoError(t, err)
			counter++
		}
		require.Equal(t, prunerMaxEvents, counter)
	})

	t.Run("will not prune deleted events", func(t *testing.T) {
		backend := setupTestStorageBackend(t)
		ctx := context.Background()

		// Create a resource
		ns := NamespacedResource{
			Namespace: "default",
			Group:     "apps",
			Resource:  "resources",
		}
		testObj, err := createTestObjectWithName("test-resource", ns, "test-data")
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

		// Create prunerMaxEvents deleted events by repeatedly deleting and recreating the resource
		// This will create: 1 initial ADDED + prunerMaxEvents cycles of (DELETE + ADDED)
		// = 1 + 20 + 20 = 41 total events (21 ADDED + 20 DELETED)
		// Multiple deleted events for a resource shouldn't happen - this is just to ensure the pruner won't remove deleted events
		previousRV := rv1
		for i := 0; i < prunerMaxEvents; i++ {
			testObj.Object["spec"].(map[string]any)["value"] = fmt.Sprintf("delete-%d", i)
			metaAccessor, err := utils.MetaAccessor(testObj)
			require.NoError(t, err)

			// Delete the resource
			writeEvent.Type = resourcepb.WatchEvent_DELETED
			writeEvent.Value = objectToJSONBytes(t, testObj)
			writeEvent.Object = metaAccessor
			writeEvent.ObjectOld = metaAccessor
			writeEvent.PreviousRV = previousRV
			_, err = backend.WriteEvent(ctx, writeEvent)
			require.NoError(t, err)

			// Recreate the resource
			testObj.Object["spec"].(map[string]any)["value"] = fmt.Sprintf("recreate-%d", i)
			writeEvent.Type = resourcepb.WatchEvent_ADDED
			writeEvent.Value = objectToJSONBytes(t, testObj)
			writeEvent.Object, err = utils.MetaAccessor(testObj)
			require.NoError(t, err)
			writeEvent.PreviousRV = 0
			previousRV, err = backend.WriteEvent(ctx, writeEvent)
			require.NoError(t, err)
		}

		pruningKey := PruningKey{
			Namespace: "default",
			Group:     "apps",
			Resource:  "resources",
			Name:      "test-resource",
		}

		err = backend.pruneEvents(ctx, pruningKey)
		require.NoError(t, err)

		// Assert all deleted events exist (20) + the most recent 20 non-deleted events
		// Pruner should keep: all 20 DELETED + 20 most recent non-deleted = 40 total
		// The oldest non-deleted event (initial ADDED) should be pruned
		counter := 0
		deletedCount := 0
		for datakey, err := range backend.dataStore.Keys(ctx, ListRequestKey{
			Namespace: "default",
			Group:     "apps",
			Resource:  "resources",
			Name:      "test-resource",
		}, SortOrderDesc) {
			require.NoError(t, err)
			if datakey.Action == DataActionDeleted {
				deletedCount++
			}
			counter++
		}
		require.Equal(t, prunerMaxEvents, deletedCount, "All deleted events should be kept")
		require.Equal(t, prunerMaxEvents*2, counter, "Should have 20 deleted + 20 non-deleted events")
	})
}

// createTestObject creates a test unstructured object with standard values
func createTestObject() (*unstructured.Unstructured, error) {
	return createTestObjectWithName("test-resource", appsNamespace, "test data")
}

// objectToJSONBytes converts an unstructured object to JSON bytes
func objectToJSONBytes(t *testing.T, obj *unstructured.Unstructured) []byte {
	jsonBytes, err := obj.MarshalJSON()
	require.NoError(t, err)
	return jsonBytes
}

// createTestObjectWithName creates a test unstructured object with specific name, group and value
func createTestObjectWithName(name string, ns NamespacedResource, value string) (*unstructured.Unstructured, error) {
	u := &unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": ns.Group + "/v1",
			"kind":       ns.Resource,
			"metadata": map[string]any{
				"name":      name,
				"namespace": ns.Namespace,
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

// TestKvStorageBackend_ClusterScopedResources tests create, update, delete, list, and watch
// operations for cluster-scoped resources (empty namespace).
// This test requires the backend to be configured with WithExperimentalClusterScoped set to true.
//
// The test verifies that:
// - All write operations accept empty namespace
// - ReadResource responses return empty namespace
// - ListIterator results return empty namespace
// - WatchWriteEvents return empty namespace
func TestKvStorageBackend_ClusterScopedResources(t *testing.T) {
	backend := setupTestStorageBackendWithClusterScope(t)
	ctx := context.Background()

	// Start watching for events before creating resources
	stream, err := backend.WatchWriteEvents(ctx)
	require.NoError(t, err)

	// Use empty namespace for cluster-scoped resources
	clusterNS := NamespacedResource{
		Namespace: "",
		Group:     "cluster.example.com",
		Resource:  "clusterresources",
	}

	// Test Create - Add 3 cluster-scoped resources
	testObj1, err := createTestObjectWithName("cluster-item1", clusterNS, "data-1")
	require.NoError(t, err)
	metaAccessor1, err := utils.MetaAccessor(testObj1)
	require.NoError(t, err)

	writeEvent1 := WriteEvent{
		Type: resourcepb.WatchEvent_ADDED,
		Key: &resourcepb.ResourceKey{
			Namespace: "",
			Group:     "cluster.example.com",
			Resource:  "clusterresources",
			Name:      "cluster-item1",
		},
		Value:      objectToJSONBytes(t, testObj1),
		Object:     metaAccessor1,
		PreviousRV: 0,
	}
	rv1, err := backend.WriteEvent(ctx, writeEvent1)
	require.NoError(t, err)
	require.Greater(t, rv1, int64(0))

	testObj2, err := createTestObjectWithName("cluster-item2", clusterNS, "data-2")
	require.NoError(t, err)
	metaAccessor2, err := utils.MetaAccessor(testObj2)
	require.NoError(t, err)

	writeEvent2 := WriteEvent{
		Type: resourcepb.WatchEvent_ADDED,
		Key: &resourcepb.ResourceKey{
			Namespace: "",
			Group:     "cluster.example.com",
			Resource:  "clusterresources",
			Name:      "cluster-item2",
		},
		Value:      objectToJSONBytes(t, testObj2),
		Object:     metaAccessor2,
		PreviousRV: 0,
	}
	rv2, err := backend.WriteEvent(ctx, writeEvent2)
	require.NoError(t, err)
	require.Greater(t, rv2, rv1)

	testObj3, err := createTestObjectWithName("cluster-item3", clusterNS, "data-3")
	require.NoError(t, err)
	metaAccessor3, err := utils.MetaAccessor(testObj3)
	require.NoError(t, err)

	writeEvent3 := WriteEvent{
		Type: resourcepb.WatchEvent_ADDED,
		Key: &resourcepb.ResourceKey{
			Namespace: "",
			Group:     "cluster.example.com",
			Resource:  "clusterresources",
			Name:      "cluster-item3",
		},
		Value:      objectToJSONBytes(t, testObj3),
		Object:     metaAccessor3,
		PreviousRV: 0,
	}
	rv3, err := backend.WriteEvent(ctx, writeEvent3)
	require.NoError(t, err)
	require.Greater(t, rv3, rv2)

	// Test Update - Modify cluster-item2
	testObj2.Object["spec"].(map[string]any)["value"] = "updated-data"
	metaAccessor2Updated, err := utils.MetaAccessor(testObj2)
	require.NoError(t, err)

	writeEvent2Updated := WriteEvent{
		Type: resourcepb.WatchEvent_MODIFIED,
		Key: &resourcepb.ResourceKey{
			Namespace: "",
			Group:     "cluster.example.com",
			Resource:  "clusterresources",
			Name:      "cluster-item2",
		},
		Value:      objectToJSONBytes(t, testObj2),
		Object:     metaAccessor2Updated,
		ObjectOld:  metaAccessor2,
		PreviousRV: rv2,
	}
	rv4, err := backend.WriteEvent(ctx, writeEvent2Updated)
	require.NoError(t, err)
	require.Greater(t, rv4, rv3)

	// Test Read - Read latest cluster-item2
	readReq := &resourcepb.ReadRequest{
		Key: &resourcepb.ResourceKey{
			Name:      "cluster-item2",
			Namespace: "", // Request with empty namespace
			Group:     "cluster.example.com",
			Resource:  "clusterresources",
		},
		ResourceVersion: 0,
	}
	response := backend.ReadResource(ctx, readReq)
	require.Nil(t, response.Error)
	require.Equal(t, rv4, response.ResourceVersion)
	require.Contains(t, string(response.Value), "updated-data")
	require.NotNil(t, response.Key, "response key should be populated")
	require.Empty(t, response.Key.Namespace, "cluster-scoped resource should have empty namespace in response")

	// Test Read - Read early version of cluster-item2
	readReq.ResourceVersion = rv3 // Should return rv2 version
	response = backend.ReadResource(ctx, readReq)
	require.Nil(t, response.Error)
	require.Equal(t, rv2, response.ResourceVersion)
	require.Contains(t, string(response.Value), "data-2")
	require.NotNil(t, response.Key, "response key should be populated")
	require.Empty(t, response.Key.Namespace, "cluster-scoped resource should have empty namespace in response")

	// Test Delete - Delete cluster-item1
	writeEvent1Delete := WriteEvent{
		Type: resourcepb.WatchEvent_DELETED,
		Key: &resourcepb.ResourceKey{
			Namespace: "",
			Group:     "cluster.example.com",
			Resource:  "clusterresources",
			Name:      "cluster-item1",
		},
		Value:      objectToJSONBytes(t, testObj1),
		Object:     metaAccessor1,
		ObjectOld:  metaAccessor1,
		PreviousRV: rv1,
	}
	rv5, err := backend.WriteEvent(ctx, writeEvent1Delete)
	require.NoError(t, err)
	require.Greater(t, rv5, rv4)

	// Test List - List all cluster-scoped resources
	listReq := &resourcepb.ListRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: "",
				Group:     "cluster.example.com",
				Resource:  "clusterresources",
			},
		},
		Limit: 10,
	}

	var listedItems []struct {
		name      string
		namespace string
		value     []byte
	}
	rv, err := backend.ListIterator(ctx, listReq, func(iter ListIterator) error {
		for iter.Next() {
			if err := iter.Error(); err != nil {
				return err
			}
			listedItems = append(listedItems, struct {
				name      string
				namespace string
				value     []byte
			}{
				name:      iter.Name(),
				namespace: iter.Namespace(),
				value:     iter.Value(),
			})
		}
		return iter.Error()
	})

	require.NoError(t, err)
	require.GreaterOrEqual(t, rv, rv5)
	require.Len(t, listedItems, 2) // cluster-item2 and cluster-item3 (item1 was deleted)

	// Verify all items have empty namespace
	for _, item := range listedItems {
		require.Empty(t, item.namespace, "cluster-scoped resources should have empty namespace")
	}

	// Verify items are sorted and have expected content
	require.Equal(t, "cluster-item2", listedItems[0].name)
	require.Contains(t, string(listedItems[0].value), "updated-data")
	require.Equal(t, "cluster-item3", listedItems[1].name)
	require.Contains(t, string(listedItems[1].value), "data-3")

	// Verify deleted resource is not in list
	readReqDeleted := &resourcepb.ReadRequest{
		Key: &resourcepb.ResourceKey{
			Name:      "cluster-item1",
			Namespace: "",
			Group:     "cluster.example.com",
			Resource:  "clusterresources",
		},
		ResourceVersion: 0,
	}
	responseDeleted := backend.ReadResource(ctx, readReqDeleted)
	require.NotNil(t, responseDeleted.Error)
	require.Equal(t, int32(404), responseDeleted.Error.Code)
	// Key should still be empty for cluster-scoped resources even on error
	if responseDeleted.Key != nil {
		require.Empty(t, responseDeleted.Key.Namespace, "cluster-scoped resource should have empty namespace even on error")
	}

	// Test Watch - Verify all events were published with empty namespace
	watchedEvents := []struct {
		name         string
		expectedType resourcepb.WatchEvent_Type
		expectedRV   int64
	}{
		{"cluster-item1", resourcepb.WatchEvent_ADDED, rv1},
		{"cluster-item2", resourcepb.WatchEvent_ADDED, rv2},
		{"cluster-item3", resourcepb.WatchEvent_ADDED, rv3},
		{"cluster-item2", resourcepb.WatchEvent_MODIFIED, rv4},
		{"cluster-item1", resourcepb.WatchEvent_DELETED, rv5},
	}

	for i, expected := range watchedEvents {
		select {
		case event := <-stream:
			require.Equal(t, expected.name, event.Key.Name, "Event %d: wrong name", i)
			require.Empty(t, event.Key.Namespace, "Event %d: cluster-scoped resource should have empty namespace", i)
			require.Equal(t, "cluster.example.com", event.Key.Group, "Event %d: wrong group", i)
			require.Equal(t, "clusterresources", event.Key.Resource, "Event %d: wrong resource", i)
			require.Equal(t, expected.expectedType, event.Type, "Event %d: wrong type", i)
			require.Equal(t, expected.expectedRV, event.ResourceVersion, "Event %d: wrong resource version", i)
		case <-ctx.Done():
			t.Fatalf("Timeout waiting for event %d", i)
		}
	}
}
