package annotationsimpl

import (
	"context"
	"errors"
	"slices"
	"sync"

	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/annotations/accesscontrol"
	"github.com/grafana/grafana/pkg/setting"
)

type CompositeStore struct {
	primary   store
	historian store
}

func NewCompositeStore(primary store, historian store) *CompositeStore {
	return &CompositeStore{
		primary:   primary,
		historian: historian,
	}
}

func (c *CompositeStore) Add(ctx context.Context, item *annotations.Item) error {
	return c.primary.Add(ctx, item)
}

func (c *CompositeStore) AddMany(ctx context.Context, items []annotations.Item) error {
	return c.primary.AddMany(ctx, items)
}

func (c *CompositeStore) Update(ctx context.Context, item *annotations.Item) error {
	return c.primary.Update(ctx, item)
}

func (c *CompositeStore) Get(ctx context.Context, query *annotations.ItemQuery, accessResources *accesscontrol.AccessResources) ([]*annotations.ItemDTO, error) {
	stores := []store{c.primary, c.historian}
	type res struct {
		items []*annotations.ItemDTO
		err   error
	}

	wg := sync.WaitGroup{}
	wg.Add(len(stores))

	ch := make(chan res, len(stores))
	for _, s := range stores {
		go func(s store) {
			defer wg.Done()
			items, err := s.Get(ctx, query, accessResources)
			ch <- res{items, err}
		}(s)
	}

	wg.Wait()
	close(ch)

	var items []*annotations.ItemDTO
	var errs []error
	for r := range ch {
		if r.err != nil {
			errs = append(errs, r.err)
		}
		items = append(items, r.items...)
	}

	if len(errs) > 0 {
		return nil, errors.Join(errs...)
	}

	// sort merged items in descending order, by TimeEnd and then by Time
	slices.SortFunc(items, func(a, b *annotations.ItemDTO) int {
		if a.TimeEnd != b.TimeEnd {
			return -1 * (int(a.TimeEnd) - int(b.TimeEnd))
		}
		return -1 * (int(a.Time) - int(b.Time))
	})

	return items, nil
}

func (c *CompositeStore) Delete(ctx context.Context, params *annotations.DeleteParams) error {
	return c.primary.Delete(ctx, params)
}

func (c *CompositeStore) GetTags(ctx context.Context, query *annotations.TagsQuery) (annotations.FindTagsResult, error) {
	return c.primary.GetTags(ctx, query)
}

func (c *CompositeStore) CleanAnnotations(ctx context.Context, cfg setting.AnnotationCleanupSettings, annotationType string) (int64, error) {
	return c.primary.CleanAnnotations(ctx, cfg, annotationType)
}

func (c *CompositeStore) CleanOrphanedAnnotationTags(ctx context.Context) (int64, error) {
	return c.primary.CleanOrphanedAnnotationTags(ctx)
}
