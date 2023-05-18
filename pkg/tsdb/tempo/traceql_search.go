package tempo

import (
	"context"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/tempo/pkg/tempopb"
	"io"
)

type SearchState int64

const (
	Pending SearchState = 0
	Running SearchState = 1
	Done    SearchState = 2
)

type TraceQLSearch struct {
	logger log.Logger
	tempopb.SearchRequest
	State   SearchState
	Result  *tempopb.SearchResponse
	Updates chan *tempopb.SearchResponse
	Errors  chan error
}

func NewTraceQLSearch(req *tempopb.SearchRequest) *TraceQLSearch {
	return &TraceQLSearch{
		logger:        log.New("tsdb.tempo.traceql_search"),
		SearchRequest: *req,
		Updates:       make(chan *tempopb.SearchResponse),
		Errors:        make(chan error),
	}
}

func (s *TraceQLSearch) close() {
	s.State = Done
	close(s.Updates)
	close(s.Errors)
}

func (s *TraceQLSearch) Run(ctx context.Context, tempoDatasource *TempoDatasource) {
	if s.State != Pending {
		return
	}

	go func() {
		s.State = Running
		s.logger.Info("Calling Search", "search request", s.SearchRequest)
		stream, err := tempoDatasource.StreamingClient.Search(ctx, &s.SearchRequest)
		if err != nil {
			s.logger.Error("Error Search()", "err", err)
		}

		defer s.close()

		for {
			msg, err := stream.Recv()
			if err == io.EOF {
				s.State = Done
				break
			}
			if err != nil {
				s.logger.Error("Error receiving message", "err", err)
				s.Errors <- err
			}

			s.logger.Info("Received message", "message", msg)

			var traceList []*tempopb.TraceSearchMetadata
			traceList = append(traceList, msg.Traces...)
			if s.Result != nil {
				traceList = append(traceList, s.Result.Traces...)
			}

			traceList = removeDuplicates(traceList)

			s.Result = &tempopb.SearchResponse{
				Metrics: msg.Metrics,
				Traces:  traceList,
			}
			s.Updates <- s.Result
		}
	}()

}

func removeDuplicates(traceList []*tempopb.TraceSearchMetadata) []*tempopb.TraceSearchMetadata {
	keys := make(map[string]bool)
	var list []*tempopb.TraceSearchMetadata

	for _, entry := range traceList {
		if _, value := keys[entry.TraceID]; !value {
			keys[entry.TraceID] = true
			list = append(list, entry)
		}
	}
	return list
}
