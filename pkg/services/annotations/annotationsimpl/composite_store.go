package annotationsimpl

import (
	"context"
	"fmt"
	"sort"

	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/grafana/dskit/concurrency"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/annotations/accesscontrol"
)

// CompositeStore is a read store that combines two or more read stores, and queries all stores in parallel.
type CompositeStore struct {
	logger  log.Logger
	readers []readStore
}

func NewCompositeStore(logger log.Logger, readers ...readStore) *CompositeStore {
	return &CompositeStore{
		logger:  logger,
		readers: readers,
	}
}

// Satisfy the commonStore interface, in practice this is not used.
func (c *CompositeStore) Type() string {
	return "composite"
}

// Get returns annotations from all stores, and combines the results.
func (c *CompositeStore) Get(ctx context.Context, query *annotations.ItemQuery, accessResources *accesscontrol.AccessResources) ([]*annotations.ItemDTO, error) {
	itemCh := make(chan []*annotations.ItemDTO, len(c.readers))

	err := concurrency.ForEachJob(ctx, len(c.readers), len(c.readers), func(ctx context.Context, i int) (err error) {
		defer handleJobPanic(c.logger, c.readers[i].Type(), &err)

		items, err := c.readers[i].Get(ctx, query, accessResources)
		itemCh <- items
		return err
	})
	if err != nil {
		return make([]*annotations.ItemDTO, 0), err
	}

	close(itemCh)
	res := make([]*annotations.ItemDTO, 0)
	for items := range itemCh {
		res = append(res, items...)
	}
	sort.Sort(annotations.SortedItems(res))

	return res, nil
}

// GetTags returns tags from all stores, and combines the results.
func (c *CompositeStore) GetTags(ctx context.Context, query *annotations.TagsQuery) (annotations.FindTagsResult, error) {
	resCh := make(chan annotations.FindTagsResult, len(c.readers))

	err := concurrency.ForEachJob(ctx, len(c.readers), len(c.readers), func(ctx context.Context, i int) (err error) {
		defer handleJobPanic(c.logger, c.readers[i].Type(), &err)

		res, err := c.readers[i].GetTags(ctx, query)
		resCh <- res
		return err
	})
	if err != nil {
		return annotations.FindTagsResult{}, err
	}

	close(resCh)
	res := make([]*annotations.TagsDTO, 0)
	for r := range resCh {
		res = append(res, r.Tags...)
	}
	sort.Sort(annotations.SortedTags(res))

	return annotations.FindTagsResult{Tags: res}, nil
}

// handleJobPanic is a helper function that recovers from a panic in a concurrent job.,
// It will log the error and set the job error if it is not nil.
func handleJobPanic(logger log.Logger, storeType string, jobErr *error) {
	if r := recover(); r != nil {
		logger.Error("Annotation store panic", "error", r, "store", storeType, "stack", log.Stack(1))
		errMsg := "concurrent job panic"

		if jobErr != nil {
			err := fmt.Errorf(errMsg)
			if panicErr, ok := r.(error); ok {
				err = fmt.Errorf("%s: %w", errMsg, panicErr)
			}
			*jobErr = err
		}
	}
}
