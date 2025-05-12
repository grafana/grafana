package resource

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestNewIndexQueueProcessor(t *testing.T) {
	mockIndex := &MockResourceIndex{}
	mockBuilder := &MockDocumentBuilder{}
	nsr := NamespacedResource{Resource: "test"}

	resChan := make(chan *IndexEvent)

	processor := newIndexQueueProcessor(mockIndex, nsr, 10, mockBuilder, resChan)

	assert.NotNil(t, processor)
	assert.Equal(t, 10, processor.batchSize)
	assert.NotNil(t, processor.queue)
}

func TestIndexQueueProcessor_SingleEvent(t *testing.T) {
	mockIndex := &MockResourceIndex{}
	mockBuilder := &MockDocumentBuilder{}
	nsr := NamespacedResource{Resource: "test"}

	resChan := make(chan *IndexEvent)

	processor := newIndexQueueProcessor(mockIndex, nsr, 10, mockBuilder, resChan)

	// Test data
	key := ResourceKey{Resource: "test", Name: "obj1", Namespace: "default"}
	evt := &WrittenEvent{
		Key:             &key,
		ResourceVersion: time.Now().UnixMicro(),
		Type:            WatchEvent_ADDED,
		Value:           []byte(`{"test": "data"}`),
	}

	// Setup expectations
	mockBuilder.On("BuildDocument", mock.Anything, &key, evt.ResourceVersion, evt.Value).Return(&IndexableDocument{Key: &key}, nil)
	mockIndex.On("BulkIndex", mock.MatchedBy(func(req *BulkIndexRequest) bool {
		return len(req.Items) == 1 && req.Items[0].Action == ActionIndex
	})).Return(nil)

	// Start processor and wait for the document to be indexed
	processor.Add(evt)

	resp := <-resChan
	assert.NotNil(t, resp)
	assert.Nil(t, resp.Err)
	assert.Equal(t, &key, resp.IndexableDocument.Key)

	mockBuilder.AssertExpectations(t)
	mockIndex.AssertExpectations(t)
}

func TestIndexQueueProcessor_BatchProcessing(t *testing.T) {
	mockIndex := &MockResourceIndex{}
	mockBuilder := &MockDocumentBuilder{}
	nsr := NamespacedResource{Namespace: "default", Resource: "test"}

	resChan := make(chan *IndexEvent)

	processor := newIndexQueueProcessor(mockIndex, nsr, 2, mockBuilder, resChan)

	// Test data for two events
	events := []*WrittenEvent{
		{
			Key:             &ResourceKey{Resource: "test", Name: "obj1", Namespace: "default"},
			ResourceVersion: time.Now().UnixMicro(),
			Type:            WatchEvent_ADDED,
			Value:           []byte(`{"test": "data1"}`),
		},
		{
			Key:             &ResourceKey{Resource: "test", Name: "obj2", Namespace: "default"},
			ResourceVersion: time.Now().UnixMicro(),
			Type:            WatchEvent_DELETED,
		},
	}

	// Setup expectations
	mockBuilder.On("BuildDocument", mock.Anything, events[0].Key, events[0].ResourceVersion, events[0].Value).
		Return(&IndexableDocument{Key: events[0].Key}, nil)
	mockIndex.On("BulkIndex", mock.MatchedBy(func(req *BulkIndexRequest) bool {
		return len(req.Items) == 2 &&
			req.Items[0].Action == ActionIndex &&
			req.Items[1].Action == ActionDelete
	})).Return(nil)

	// Start processor and add events
	processor.Add(events[0])
	processor.Add(events[1])

	r0 := <-resChan
	assert.Nil(t, r0.Err)
	assert.Equal(t, events[0].Key, r0.IndexableDocument.Key)

	r1 := <-resChan
	assert.Nil(t, r1.Err)
	assert.Nil(t, r1.IndexableDocument) // deleted event

	mockBuilder.AssertExpectations(t)
	mockIndex.AssertExpectations(t)
}

func TestIndexQueueProcessor_BuildDocumentError(t *testing.T) {
	mockIndex := &MockResourceIndex{}
	mockBuilder := &MockDocumentBuilder{}
	nsr := NamespacedResource{Resource: "test"}

	resChan := make(chan *IndexEvent)

	processor := newIndexQueueProcessor(mockIndex, nsr, 10, mockBuilder, resChan)

	evt := &WrittenEvent{
		Key:             &ResourceKey{Resource: "test", Name: "obj1", Namespace: "default"},
		ResourceVersion: time.Now().UnixMicro(),
		Type:            WatchEvent_ADDED,
		Value:           []byte(`invalid json`),
	}

	// Setup expectations for error case
	mockBuilder.On("BuildDocument", mock.Anything, evt.Key, evt.ResourceVersion, evt.Value).
		Return(nil, assert.AnError)

	// The bulk index should not be called since document building failed
	mockIndex.On("BulkIndex", mock.Anything).Return(nil).Maybe()

	processor.Add(evt)

	resp := <-resChan
	assert.NotNil(t, resp)
	assert.Error(t, resp.Err)
	assert.Nil(t, resp.IndexableDocument)

	mockBuilder.AssertExpectations(t)
	mockIndex.AssertExpectations(t)
}

func TestIndexQueueProcessor_BulkIndexError(t *testing.T) {
	mockIndex := &MockResourceIndex{}
	mockBuilder := &MockDocumentBuilder{}
	nsr := NamespacedResource{Resource: "test"}

	resChan := make(chan *IndexEvent)

	processor := newIndexQueueProcessor(mockIndex, nsr, 10, mockBuilder, resChan)

	evt := &WrittenEvent{
		Key:             &ResourceKey{Resource: "test", Name: "obj1", Namespace: "default"},
		ResourceVersion: time.Now().UnixMicro(),
		Type:            WatchEvent_ADDED,
		Value:           []byte(`{"test": "data"}`),
	}

	// Setup expectations
	mockBuilder.On("BuildDocument", mock.Anything, evt.Key, evt.ResourceVersion, evt.Value).
		Return(&IndexableDocument{Key: evt.Key}, nil)
	mockIndex.On("BulkIndex", mock.Anything).Return(assert.AnError)

	processor.Add(evt)

	resp := <-resChan
	assert.NotNil(t, resp)
	assert.Error(t, resp.Err)

	mockBuilder.AssertExpectations(t)
	mockIndex.AssertExpectations(t)
}
