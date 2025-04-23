package resource

import (
	"context"
	"sync"
	"time"
)

// IndexQueueProcessor manages queue-based operations for a specific index
// It is responsible for ingesting events for a single index
// It will batch events and send them to the index in a single bulk request
type IndexQueueProcessor struct {
	index     ResourceIndex
	nsr       NamespacedResource
	queue     chan *indexEvent
	batchSize int
	cancel    context.CancelFunc
	builder   DocumentBuilder

	mu      sync.Mutex
	running bool
}

type indexEvent struct {
	ev   *WrittenEvent
	done chan *IndexResult
}

type IndexResult struct {
	doc *IndexableDocument
	err error
}

// NewIndexQueueProcessor creates a new IndexQueueProcessor for the given index
func NewIndexQueueProcessor(index ResourceIndex, nsr NamespacedResource, batchSize int, builder DocumentBuilder) *IndexQueueProcessor {
	return &IndexQueueProcessor{
		index:     index,
		nsr:       nsr,
		queue:     make(chan *indexEvent, 1000), // Buffer size of 1000 events
		batchSize: batchSize,
		builder:   builder,
		running:   false,
	}
}

// Add adds an event to the queue and ensures the background processor is running
// Returns a channel that will receive the indexed document when processing is complete
func (b *IndexQueueProcessor) Add(evt *WrittenEvent) <-chan *IndexResult {
	done := make(chan *IndexResult, 1)
	b.mu.Lock()
	defer b.mu.Unlock()
	if !b.running {
		b.running = true
		b.startProcessor()
	}
	b.queue <- &indexEvent{ev: evt, done: done}
	return done
}

// startProcessor starts the background goroutine if it's not already running
func (b *IndexQueueProcessor) startProcessor() {
	// No need for lock here since running is already set
	go func() {
		defer func() {
			b.mu.Lock()
			b.running = false
			b.mu.Unlock()
		}()

		for {
			batch := make([]*indexEvent, 0, b.batchSize)
			select {
			case evt := <-b.queue:
				batch = append(batch, evt)
			default:
				// No need for stop() method, just return and let defer handle it
				return
			}

		prepare:
			for len(batch) < b.batchSize {
				select {
				case evt := <-b.queue:
					batch = append(batch, evt)
				default:
					break prepare
				}
			}

			b.process(batch)
		}
	}()
}

// process handles a batch of events
func (b *IndexQueueProcessor) process(batch []*indexEvent) {
	if len(batch) == 0 {
		return
	}

	// Create bulk request
	req := &BulkIndexRequest{
		Items: make([]*BulkIndexItem, 0, len(batch)),
	}
	resp := make([]*IndexResult, 0, len(batch))

	for _, i := range batch {
		result := &IndexResult{}
		resp = append(resp, result)

		evt := i.ev
		item := &BulkIndexItem{}
		if evt.Type == WatchEvent_DELETED {
			item.Action = BulkActionDelete
			item.Key = evt.Key
		} else {
			item.Action = BulkActionIndex
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			doc, err := b.builder.BuildDocument(ctx, evt.Key, evt.ResourceVersion, evt.Value)
			if err != nil {
				result.err = err
			} else {
				item.Doc = doc
				result.doc = doc
			}
		}
		req.Items = append(req.Items, item)
	}

	err := b.index.BulkIndex(req)
	if err != nil {
		for _, r := range resp {
			r.err = err
		}
	}

	// Send results to the channel
	for idx, i := range batch {
		i.done <- resp[idx]
	}
}
