package parquet

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"sync"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var (
	_ resource.StorageBackend         = (*parquetBackend)(nil)
	_ resource.BatchProcessingBackend = (*parquetBackend)(nil)
)

type parquetBackend struct {
	f *os.File

	mutex       sync.Mutex
	broadcaster resource.Broadcaster[*resource.WrittenEvent]
	stream      chan<- *resource.WrittenEvent
}

func NewParquetBatchProcessingBackend(f *os.File) (*parquetBackend, error) {
	return &parquetBackend{
		f: f,
	}, nil
}

// ProcessBatch implements resource.BatchProcessingBackend.
func (p *parquetBackend) ProcessBatch(ctx context.Context, setting resource.BatchSettings, iter resource.BatchRequestIterator) *resource.BatchResponse {
	writer, err := NewParquetWriter(p.f)
	if err != nil {
		return &resource.BatchResponse{
			Error: resource.AsErrorResult(err),
		}
	}
	defer func() { _ = writer.Close() }()

	for iter.Next() {
		if iter.RollbackRequested() {
			fmt.Printf("Rollback requested %s\n", p.f.Name())
			break
		}

		req := iter.Request()

		err = writer.Add(ctx, req.Key, req.Value)
		if err != nil {
			break
		}
	}

	rsp := writer.Results()
	if rsp == nil {
		rsp = &resource.BatchResponse{}
	}
	if err != nil {
		rsp.Error = resource.AsErrorResult(err)
	}
	return rsp
}

// GetResourceStats implements resource.StorageBackend.
func (p *parquetBackend) GetResourceStats(ctx context.Context, namespace string, minCount int) ([]resource.ResourceStats, error) {
	return nil, fmt.Errorf("[parquetBackend] not implemented (GetResourceStats)")
}

// ListIterator implements resource.StorageBackend.
func (p *parquetBackend) ListIterator(context.Context, *resource.ListRequest, func(resource.ListIterator) error) (int64, error) {
	return 0, fmt.Errorf("[parquetBackend] not implemented (ListIterator)")
}

// ReadResource implements resource.StorageBackend.
func (p *parquetBackend) ReadResource(context.Context, *resource.ReadRequest) *resource.BackendReadResponse {
	return &resource.BackendReadResponse{
		Error: &resource.ErrorResult{
			Code: http.StatusNotImplemented,
		},
	}
}

// WriteEvent implements resource.StorageBackend.
func (p *parquetBackend) WriteEvent(context.Context, resource.WriteEvent) (int64, error) {
	return 0, fmt.Errorf("[parquetBackend] not implemented (WriteEvent)")
}

// WatchWriteEvents implements resource.StorageBackend.
func (p *parquetBackend) WatchWriteEvents(ctx context.Context) (<-chan *resource.WrittenEvent, error) {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	if p.broadcaster == nil {
		var err error
		p.broadcaster, err = resource.NewBroadcaster(context.Background(), func(c chan<- *resource.WrittenEvent) error {
			p.stream = c
			return nil
		})
		if err != nil {
			return nil, err
		}
	}
	return p.broadcaster.Subscribe(ctx)
}
