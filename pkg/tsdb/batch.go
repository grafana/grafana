package tsdb

import "context"

type Batch struct {
	DataSourceId int64
	Queries      []*Query
	Depends      map[string]bool
	Done         bool
	Started      bool
}

type BatchSlice []*Batch

func newBatch(dsId int64, queries []*Query) *Batch {
	return &Batch{
		DataSourceId: dsId,
		Queries:      queries,
		Depends:      make(map[string]bool),
	}
}

func (bg *Batch) process(ctx context.Context, resultChan chan *BatchResult, tsdbQuery *TsdbQuery) {
	executor, err := getTsdbQueryEndpointFor(bg.Queries[0].DataSource)

	if err != nil {
		bg.Done = true
		result := &BatchResult{
			Error:        err,
			QueryResults: make(map[string]*QueryResult),
		}
		for _, query := range bg.Queries {
			result.QueryResults[query.RefId] = &QueryResult{Error: result.Error}
		}
		resultChan <- result
		return
	}

	res := executor.Query(ctx, &TsdbQuery{
		Queries:   bg.Queries,
		TimeRange: tsdbQuery.TimeRange,
	})
	bg.Done = true
	resultChan <- res
}

func (bg *Batch) addQuery(query *Query) {
	bg.Queries = append(bg.Queries, query)
}

func (bg *Batch) allDependenciesAreIn(res *Response) bool {
	for key := range bg.Depends {
		if _, exists := res.Results[key]; !exists {
			return false
		}
	}

	return true
}

func getBatches(req *TsdbQuery) (BatchSlice, error) {
	batches := make(BatchSlice, 0)

	for _, query := range req.Queries {
		if foundBatch := findMatchingBatchGroup(query, batches); foundBatch != nil {
			foundBatch.addQuery(query)
		} else {
			newBatch := newBatch(query.DataSource.Id, []*Query{query})
			batches = append(batches, newBatch)

			for _, refId := range query.Depends {
				for _, batch := range batches {
					for _, batchQuery := range batch.Queries {
						if batchQuery.RefId == refId {
							newBatch.Depends[refId] = true
						}
					}
				}
			}
		}
	}

	return batches, nil
}

func findMatchingBatchGroup(query *Query, batches BatchSlice) *Batch {
	for _, batch := range batches {
		if batch.DataSourceId == query.DataSource.Id {
			return batch
		}
	}
	return nil
}
