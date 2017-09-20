package tsdb

import (
	"context"
)

type HandleRequestFunc func(ctx context.Context, req *TsdbQuery) (*Response, error)

func HandleRequest(ctx context.Context, req *TsdbQuery) (*Response, error) {
	tsdbQuery := &TsdbQuery{
		Queries:   req.Queries,
		TimeRange: req.TimeRange,
	}

	batches, err := getBatches(req)
	if err != nil {
		return nil, err
	}

	currentlyExecuting := 0
	resultsChan := make(chan *BatchResult)

	for _, batch := range batches {
		if len(batch.Depends) == 0 {
			currentlyExecuting += 1
			batch.Started = true
			go batch.process(ctx, resultsChan, tsdbQuery)
		}
	}

	response := &Response{
		Results: make(map[string]*QueryResult),
	}

	for currentlyExecuting != 0 {
		select {
		case batchResult := <-resultsChan:
			currentlyExecuting -= 1

			response.BatchTimings = append(response.BatchTimings, batchResult.Timings)

			if batchResult.Error != nil {
				return nil, batchResult.Error
			}

			for refId, result := range batchResult.QueryResults {
				response.Results[refId] = result
			}

			for _, batch := range batches {
				// not interested in started batches
				if batch.Started {
					continue
				}

				if batch.allDependenciesAreIn(response) {
					currentlyExecuting += 1
					batch.Started = true
					go batch.process(ctx, resultsChan, tsdbQuery)
				}
			}
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}

	//response.Results = tsdbQuery.Results
	return response, nil
}
