package resource

import (
	"context"
	"io"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func setupTestStorageBackend(t *testing.T) *kvStorageBackend {
	kv := setupTestKV(t)
	return NewkvStorageBackend(kv)
}

func TestNewkvStorageBackend(t *testing.T) {
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
					Resource:  "resource",
					Name:      "test-resource",
				},
				Value:      objectToJSONBytes(t, testObj),
				Object:     metaAccessor,
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
			}

			dataKey := DataKey{
				Namespace:       "default",
				Group:           "apps",
				Resource:        "resource",
				Name:            "test-resource",
				ResourceVersion: rv,
				Action:          expectedAction,
			}

			dataReader, err := backend.dataStore.Get(ctx, dataKey)
			require.NoError(t, err)
			dataValue, err := io.ReadAll(dataReader)
			require.NoError(t, err)
			assert.Equal(t, objectToJSONBytes(t, testObj), dataValue)

			// Verify metadata was written to metaStore
			metaKey := MetaDataKey{
				Namespace:       "default",
				Group:           "apps",
				Resource:        "resource",
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
			require.Equal(t, "resource", m.Key.Resource)

			// Verify event was written to eventStore
			eventKey := EventKey{
				Namespace:       "default",
				Group:           "apps",
				Resource:        "resource",
				Name:            "test-resource",
				ResourceVersion: rv,
			}

			_, err = backend.eventStore.Get(ctx, eventKey)
			require.NoError(t, err)
		})
	}
}

func TestKvStorageBackend_ReadResource_Success(t *testing.T) {
	backend := setupTestStorageBackend(t)
	ctx := context.Background()

	// First, write a resource to read
	testObj, err := createTestObject()
	require.NoError(t, err)

	metaAccessor, err := utils.MetaAccessor(testObj)
	require.NoError(t, err)

	writeEvent := WriteEvent{
		Type: resourcepb.WatchEvent_ADDED,
		Key: &resourcepb.ResourceKey{
			Namespace: "default",
			Group:     "apps",
			Resource:  "deployments",
			Name:      "test-deployment",
		},
		Value:      objectToJSONBytes(t, testObj),
		Object:     metaAccessor,
		PreviousRV: 0,
	}

	rv, err := backend.WriteEvent(ctx, writeEvent)
	require.NoError(t, err)

	// Now test reading the resource
	readReq := &resourcepb.ReadRequest{
		Key: &resourcepb.ResourceKey{
			Namespace: "default",
			Group:     "apps",
			Resource:  "deployments",
			Name:      "test-deployment",
		},
		ResourceVersion: 0, // Read latest version
	}

	response := backend.ReadResource(ctx, readReq)
	require.Nil(t, response.Error, "ReadResource should succeed")
	require.NotNil(t, response.Key, "Response should have a key")
	require.Equal(t, "test-deployment", response.Key.Name)
	require.Equal(t, "default", response.Key.Namespace)
	require.Equal(t, "apps", response.Key.Group)
	require.Equal(t, "deployments", response.Key.Resource)
	require.Equal(t, rv, response.ResourceVersion)
	require.Equal(t, objectToJSONBytes(t, testObj), response.Value)
}

func TestKvStorageBackend_ReadResource_SpecificVersion(t *testing.T) {
	backend := setupTestStorageBackend(t)
	ctx := context.Background()

	// Create initial version
	testObj, err := createTestObject()
	require.NoError(t, err)

	metaAccessor, err := utils.MetaAccessor(testObj)
	require.NoError(t, err)

	writeEvent := WriteEvent{
		Type: resourcepb.WatchEvent_ADDED,
		Key: &resourcepb.ResourceKey{
			Namespace: "default",
			Group:     "apps",
			Resource:  "deployments",
			Name:      "test-deployment",
		},
		Value:      objectToJSONBytes(t, testObj),
		Object:     metaAccessor,
		PreviousRV: 0,
	}

	rv1, err := backend.WriteEvent(ctx, writeEvent)
	require.NoError(t, err)

	// Update the resource
	testObj.Object["spec"].(map[string]any)["value"] = "updated data"
	writeEvent.Type = resourcepb.WatchEvent_MODIFIED
	writeEvent.Value = objectToJSONBytes(t, testObj)
	writeEvent.PreviousRV = rv1

	rv2, err := backend.WriteEvent(ctx, writeEvent)
	require.NoError(t, err)

	// Read the first version specifically
	readReq := &resourcepb.ReadRequest{
		Key: &resourcepb.ResourceKey{
			Namespace: "default",
			Group:     "apps",
			Resource:  "deployments",
			Name:      "test-deployment",
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
			Resource:  "deployments",
			Name:      "nonexistent-deployment",
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
	testObj, err := createTestObject()
	require.NoError(t, err)

	metaAccessor, err := utils.MetaAccessor(testObj)
	require.NoError(t, err)

	writeEvent := WriteEvent{
		Type: resourcepb.WatchEvent_ADDED,
		Key: &resourcepb.ResourceKey{
			Namespace: "default",
			Group:     "apps",
			Resource:  "deployments",
			Name:      "test-deployment",
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

	_, err = backend.WriteEvent(ctx, writeEvent)
	require.NoError(t, err)

	// Try to read the latest version (should be deleted and return not found)
	readReq := &resourcepb.ReadRequest{
		Key: &resourcepb.ResourceKey{
			Namespace: "default",
			Group:     "apps",
			Resource:  "deployments",
			Name:      "test-deployment",
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

// createTestObject creates a test unstructured object
func createTestObject() (*unstructured.Unstructured, error) {
	u := &unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": "apps/v1",
			"kind":       "resource",
			"metadata": map[string]any{
				"name":      "test-resource",
				"namespace": "default",
			},
			"spec": map[string]any{
				"value": "test data",
			},
		},
	}
	return u, nil
}

// objectToJSONBytes converts an unstructured object to JSON bytes
func objectToJSONBytes(t *testing.T, obj *unstructured.Unstructured) []byte {
	jsonBytes, err := obj.MarshalJSON()
	require.NoError(t, err)
	return jsonBytes
}
