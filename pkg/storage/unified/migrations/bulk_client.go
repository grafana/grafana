package migrations

import (
	"fmt"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const (
	defaultBulkProcessBatchMaxItems = 1000
	defaultBulkProcessBatchMaxBytes = 2 * 1024 * 1024
)

type bulkProcessBatchOptions struct {
	MaxItems int
	MaxBytes int
}

func defaultBulkProcessBatchOptions() bulkProcessBatchOptions {
	return bulkProcessBatchOptions{
		MaxItems: defaultBulkProcessBatchMaxItems,
		MaxBytes: defaultBulkProcessBatchMaxBytes,
	}
}

type bulkProcessBatchingClient struct {
	resourcepb.BulkStore_BulkProcessBatchedClient

	maxItems int
	maxBytes int

	batch     []*resourcepb.BulkRequest
	batchSize int
}

func newBulkProcessBatchingClient(stream resourcepb.BulkStore_BulkProcessBatchedClient, opts bulkProcessBatchOptions) resourcepb.BulkStore_BulkProcessClient {
	if opts.MaxItems <= 0 {
		opts.MaxItems = defaultBulkProcessBatchMaxItems
	}
	if opts.MaxBytes <= 0 {
		opts.MaxBytes = defaultBulkProcessBatchMaxBytes
	}

	return &bulkProcessBatchingClient{
		BulkStore_BulkProcessBatchedClient: stream,
		maxItems:                           opts.MaxItems,
		maxBytes:                           opts.MaxBytes,
	}
}

func (c *bulkProcessBatchingClient) Send(req *resourcepb.BulkRequest) error {
	if req == nil {
		return fmt.Errorf("missing bulk request")
	}

	c.batch = append(c.batch, req)
	c.batchSize += len(req.Value)

	if len(c.batch) >= c.maxItems || c.batchSize >= c.maxBytes {
		return c.flush()
	}

	return nil
}

func (c *bulkProcessBatchingClient) CloseAndRecv() (*resourcepb.BulkResponse, error) {
	if err := c.flush(); err != nil {
		return nil, err
	}

	return c.BulkStore_BulkProcessBatchedClient.CloseAndRecv()
}

func (c *bulkProcessBatchingClient) flush() error {
	if len(c.batch) == 0 {
		return nil
	}

	batch := &resourcepb.BulkRequestBatch{Items: c.batch}
	c.batch = nil
	c.batchSize = 0

	return c.BulkStore_BulkProcessBatchedClient.Send(batch)
}
