package annotationsimpl

import (
	"context"
	"errors"
	"slices"
	"sort"
	"sync"

	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/annotations/accesscontrol"
)

// CompositeStore is a read store that combines two or more read stores, and queries all stores in parallel.
type CompositeStore struct {
	readers []readStore
}

func NewCompositeStore(readers []readStore) *CompositeStore {
	return &CompositeStore{
		readers: readers,
	}
}

func (c *CompositeStore) Get(ctx context.Context, query *annotations.ItemQuery, accessResources *accesscontrol.AccessResources) ([]*annotations.ItemDTO, error) {
	ch := make(chan jobRes[[]*annotations.ItemDTO], len(c.readers))
	wg := sync.WaitGroup{}
	wg.Add(len(c.readers))

	for _, r := range c.readers {
		go func(r readStore) {
			defer wg.Done()
			ch <- collectRes(r.Get(ctx, query, accessResources))
		}(r)
	}

	wg.Wait()
	close(ch)

	res := make([]*annotations.ItemDTO, 0)
	var err error
	for r := range ch {
		if r.err != nil {
			err = errors.Join(err, r.err)
		} else {
			res = append(res, r.res...)
		}
	}

	// sort merged items in descending order, by TimeEnd and then by Time
	slices.SortFunc(res, func(a, b *annotations.ItemDTO) int {
		if a.TimeEnd != b.TimeEnd {
			return -1 * (int(a.TimeEnd) - int(b.TimeEnd))
		}
		return -1 * (int(a.Time) - int(b.Time))
	})

	return res, err
}

func (c *CompositeStore) GetTags(ctx context.Context, query *annotations.TagsQuery) (annotations.FindTagsResult, error) {
	ch := make(chan jobRes[annotations.FindTagsResult], len(c.readers))
	wg := sync.WaitGroup{}
	wg.Add(len(c.readers))

	for _, r := range c.readers {
		go func(r readStore) {
			defer wg.Done()
			ch <- collectRes(r.GetTags(ctx, query))
		}(r)
	}

	wg.Wait()
	close(ch)

	res := make([]*annotations.TagsDTO, 0)
	var err error
	for r := range ch {
		if r.err != nil {
			err = errors.Join(err, r.err)
		} else {
			res = append(res, r.res.Tags...)
		}
	}

	// sort merged tags in ascending order
	sort.Slice(res, func(i, j int) bool {
		return res[i].Tag < res[j].Tag
	})

	return annotations.FindTagsResult{Tags: res}, err
}

type jobRes[T any] struct {
	res T
	err error
}

func collectRes[T any](res T, err error) jobRes[T] {
	return jobRes[T]{res, err}
}
