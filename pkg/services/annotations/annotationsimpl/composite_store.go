package annotationsimpl

import (
	"context"
	"sort"

	"github.com/grafana/dskit/concurrency"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/annotations/accesscontrol"
)

// CompositeStore is a read store that combines two or more read stores, and queries all stores in parallel.
type CompositeStore struct {
	readers []readStore
}

func NewCompositeStore(readers ...readStore) *CompositeStore {
	return &CompositeStore{
		readers: readers,
	}
}

// Get returns annotations from all stores, and combines the results.
func (c *CompositeStore) Get(ctx context.Context, query *annotations.ItemQuery, accessResources *accesscontrol.AccessResources) ([]*annotations.ItemDTO, error) {
	itemCh := make(chan []*annotations.ItemDTO, len(c.readers))

	err := concurrency.ForEachJob(ctx, len(c.readers), len(c.readers), func(ctx context.Context, i int) error {
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

	err := concurrency.ForEachJob(ctx, len(c.readers), len(c.readers), func(ctx context.Context, i int) error {
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
