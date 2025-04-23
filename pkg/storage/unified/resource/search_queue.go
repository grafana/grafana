package resource

import (
	"context"
	"sync"
	"time"
)

// indexQueueProcessor manages queue-based operations for a specific index
// It is responsible for ingesting events for a single index
// It will batch events and send them to the index in a single bulk request
type indexQueueProcessor struct {
	index     ResourceIndex
	nsr       NamespacedResource
	queue     chan *WrittenEvent
	batchSize int
	cancel    context.CancelFunc
	builder   DocumentBuilder

	resChan chan *IndexEvent // Channel to send results to the caller

	mu      sync.Mutex
	running bool
}

type indexEvent struct {
	ev   *WrittenEvent
	done chan *IndexEvent
}

type IndexEvent struct {
	WrittenEvent      *WrittenEvent
	Action            IndexAction
	IndexableDocument *IndexableDocument // empty for delete actions
	Timestamp         time.Time
	Latency           time.Duration
	Err               error
}

// NewIndexQueueProcessor creates a new IndexQueueProcessor for the given index
func NewIndexQueueProcessor(index ResourceIndex, nsr NamespacedResource, batchSize int, builder DocumentBuilder, resChan chan *IndexEvent) *indexQueueProcessor {
	return &indexQueueProcessor{
		index:     index,
		nsr:       nsr,
		queue:     make(chan *WrittenEvent, 1000), // Buffer size of 1000 events
		batchSize: batchSize,
		builder:   builder,
		resChan:   resChan,
		running:   false,
	}
}

// Add adds an event to the queue and ensures the background processor is running
func (b *indexQueueProcessor) Add(evt *WrittenEvent) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if !b.running {
		b.running = true
		b.startProcessor()
	}
	b.queue <- evt
}

// startProcessor starts the background goroutine if it's not already running
func (b *indexQueueProcessor) startProcessor() {
	// No need for lock here since running is already set
	go func() {
		defer func() {
			b.mu.Lock()
			b.running = false
			b.mu.Unlock()
		}()

		for {
			batch := make([]*WrittenEvent, 0, b.batchSize)
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
func (b *indexQueueProcessor) process(batch []*WrittenEvent) {
	if len(batch) == 0 {
		return
	}

	// Create bulk request
	req := &BulkIndexRequest{
		Items: make([]*BulkIndexItem, 0, len(batch)),
	}
	resp := make([]*IndexEvent, 0, len(batch))

	for _, evt := range batch {
		result := &IndexEvent{
			WrittenEvent: evt,
		}
		resp = append(resp, result)

		item := &BulkIndexItem{}
		if evt.Type == WatchEvent_DELETED {
			item.Action = ActionDelete
			item.Key = evt.Key
		} else {
			item.Action = ActionIndex
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			doc, err := b.builder.BuildDocument(ctx, evt.Key, evt.ResourceVersion, evt.Value)
			if err != nil {
				result.Err = err
			} else {
				item.Doc = doc
				result.IndexableDocument = doc
			}
		}
		req.Items = append(req.Items, item)
	}

	err := b.index.BulkIndex(req)
	if err != nil {
		for _, r := range resp {
			r.Err = err
		}
	}
	ts := time.Now()
	if b.resChan != nil {
		for _, r := range resp {
			r.Timestamp = ts
			r.Latency = time.Duration(ts.UnixMicro()-r.WrittenEvent.ResourceVersion) * time.Microsecond
			b.resChan <- r
		}
	}
}
