package resource

import (
	"fmt"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var _ resourcepb.BulkStore_BulkProcessServer = (*bulkProcessBatchFlattener)(nil)

func (s *server) BulkProcessBatched(stream resourcepb.BulkStore_BulkProcessBatchedServer) error {
	return s.BulkProcess(&bulkProcessBatchFlattener{BulkStore_BulkProcessBatchedServer: stream})
}

type bulkProcessBatchFlattener struct {
	resourcepb.BulkStore_BulkProcessBatchedServer

	pending []*resourcepb.BulkRequest
	index   int
}

func (s *bulkProcessBatchFlattener) Recv() (*resourcepb.BulkRequest, error) {
	for {
		if s.index < len(s.pending) {
			req := s.pending[s.index]
			s.index++
			return req, nil
		}

		batch, err := s.BulkStore_BulkProcessBatchedServer.Recv()
		if err != nil {
			return nil, err
		}
		if batch == nil || len(batch.Items) == 0 {
			return nil, fmt.Errorf("missing request batch")
		}

		s.pending = batch.Items
		s.index = 0
	}
}
