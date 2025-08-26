package resource

import (
	"context"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// indexQueueProcessor manages queue-based operations for a specific index
// It is responsible for ingesting events for a single index
// It will batch events and send them to the index in a single bulk request
type indexQueueProcessor struct {
	nsr       NamespacedResource
	queue     chan *WrittenEvent
	batchSize int
	builder   DocumentBuilder

	resChan chan *IndexEvent // Channel to send results to the caller

	indexMu sync.Mutex
	index   ResourceIndex

	runningMu sync.Mutex
	running   bool
}

type IndexEvent struct {
	WrittenEvent      *WrittenEvent
	Action            IndexAction
	IndexableDocument *IndexableDocument // empty for delete actions
	Timestamp         time.Time
	Latency           time.Duration
	Err               error
}

func (b *indexQueueProcessor) updateIndex(newIndex ResourceIndex) {
	b.indexMu.Lock()
	defer b.indexMu.Unlock()
	b.index = newIndex
}

// newIndexQueueProcessor creates a new IndexQueueProcessor for the given index
func newIndexQueueProcessor(index ResourceIndex, nsr NamespacedResource, batchSize int, builder DocumentBuilder, resChan chan *IndexEvent) *indexQueueProcessor {
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
	b.queue <- evt

	// Start the processor if it's not already running
	b.runningMu.Lock()
	defer b.runningMu.Unlock()
	if !b.running {
		b.running = true
		go b.runProcessor()
	}
}

// runProcessor is the task processing the queue of written events
func (b *indexQueueProcessor) runProcessor() {
	defer func() {
		b.runningMu.Lock()
		b.running = false
		b.runningMu.Unlock()
	}()

	for {
		batch := make([]*WrittenEvent, 0, b.batchSize)
		select {
		case evt := <-b.queue:
			batch = append(batch, evt)
		case <-time.After(5 * time.Second):
			// No events in the past few seconds, stop the processor
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
		if evt.Type == resourcepb.WatchEvent_DELETED {
			item.Action = ActionDelete
			item.Key = evt.Key
		} else {
			item.Action = ActionIndex
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			doc, err := b.builder.BuildDocument(ctx, evt.Key, evt.ResourceVersion, evt.Value)
			cancel()

			if err != nil {
				result.Err = err
			} else {
				item.Doc = doc
				result.IndexableDocument = doc
			}
		}
		req.Items = append(req.Items, item)
	}

	b.indexMu.Lock()
	idx := b.index
	b.indexMu.Unlock()

	err := idx.BulkIndex(req)
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
