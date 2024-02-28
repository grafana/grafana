package annotationsimpl

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/annotations/accesscontrol"
	"github.com/stretchr/testify/require"
)

var (
	errGet     = errors.New("get error")
	errGetTags = errors.New("get tags error")
)

func TestCompositeStore(t *testing.T) {
	t.Run("should handle panic", func(t *testing.T) {
		r1 := newFakeReader()
		getPanic := func(context.Context, *annotations.ItemQuery, *accesscontrol.AccessResources) ([]*annotations.ItemDTO, error) {
			panic("ohno")
		}
		r2 := newFakeReader(withGetFn(getPanic))
		store := &CompositeStore{
			log.NewNopLogger(),
			[]readStore{r1, r2},
		}

		_, err := store.Get(context.Background(), nil, nil)
		require.Error(t, err)
		require.Contains(t, err.Error(), "concurrent job panic")
	})

	t.Run("should return first error", func(t *testing.T) {
		err1 := errors.New("error 1")
		r1 := newFakeReader(withError(err1))
		err2 := errors.New("error 2")
		r2 := newFakeReader(withError(err2), withWait(10*time.Millisecond))

		store := &CompositeStore{
			log.NewNopLogger(),
			[]readStore{r1, r2},
		}

		tc := []struct {
			f   func() (any, error)
			err error
		}{
			{
				f:   func() (any, error) { return store.Get(context.Background(), nil, nil) },
				err: errGet,
			},
			{
				f:   func() (any, error) { return store.GetTags(context.Background(), nil) },
				err: errGetTags,
			},
		}

		for _, tt := range tc {
			_, err := tt.f()
			require.Error(t, err)
			require.ErrorIs(t, err, err1)
			require.NotErrorIs(t, err, err2)
		}
	})

	t.Run("should combine and sort results from Get", func(t *testing.T) {
		items1 := []*annotations.ItemDTO{
			{TimeEnd: 1, Time: 2},
			{TimeEnd: 2, Time: 1},
		}
		r1 := newFakeReader(withItems(items1))

		items2 := []*annotations.ItemDTO{
			{TimeEnd: 1, Time: 1},
			{TimeEnd: 1, Time: 3},
		}
		r2 := newFakeReader(withItems(items2))

		store := &CompositeStore{
			log.NewNopLogger(),
			[]readStore{r1, r2},
		}

		expected := []*annotations.ItemDTO{
			{TimeEnd: 2, Time: 1},
			{TimeEnd: 1, Time: 3},
			{TimeEnd: 1, Time: 2},
			{TimeEnd: 1, Time: 1},
		}

		items, _ := store.Get(context.Background(), nil, nil)
		require.Equal(t, expected, items)
	})

	t.Run("should combine and sort results from GetTags", func(t *testing.T) {
		tags1 := []*annotations.TagsDTO{
			{Tag: "key1:val1"},
			{Tag: "key2:val1"},
		}
		r1 := newFakeReader(withTags(tags1))

		tags2 := []*annotations.TagsDTO{
			{Tag: "key1:val2"},
			{Tag: "key2:val2"},
		}
		r2 := newFakeReader(withTags(tags2))

		store := &CompositeStore{
			log.NewNopLogger(),
			[]readStore{r1, r2},
		}

		expected := []*annotations.TagsDTO{
			{Tag: "key1:val1"},
			{Tag: "key1:val2"},
			{Tag: "key2:val1"},
			{Tag: "key2:val2"},
		}

		res, _ := store.GetTags(context.Background(), nil)
		require.Equal(t, expected, res.Tags)
	})
}

type fakeReader struct {
	items    []*annotations.ItemDTO
	tagRes   annotations.FindTagsResult
	getFn    func(context.Context, *annotations.ItemQuery, *accesscontrol.AccessResources) ([]*annotations.ItemDTO, error)
	getTagFn func(context.Context, *annotations.TagsQuery) (annotations.FindTagsResult, error)
	wait     time.Duration
	err      error
}

func (f *fakeReader) Type() string {
	return "fake"
}

func (f *fakeReader) Get(ctx context.Context, query *annotations.ItemQuery, accessResources *accesscontrol.AccessResources) ([]*annotations.ItemDTO, error) {
	if f.getFn != nil {
		return f.getFn(ctx, query, accessResources)
	}

	if f.wait > 0 {
		time.Sleep(f.wait)
	}

	if f.err != nil {
		err := fmt.Errorf("%w: %w", errGet, f.err)
		return nil, err
	}

	return f.items, nil
}

func (f *fakeReader) GetTags(ctx context.Context, query *annotations.TagsQuery) (annotations.FindTagsResult, error) {
	if f.getTagFn != nil {
		return f.getTagFn(ctx, query)
	}

	if f.wait > 0 {
		time.Sleep(f.wait)
	}

	if f.err != nil {
		err := fmt.Errorf("%w: %w", errGetTags, f.err)
		return annotations.FindTagsResult{}, err
	}

	return f.tagRes, nil
}

func withWait(wait time.Duration) func(*fakeReader) {
	return func(f *fakeReader) {
		f.wait = wait
	}
}

func withError(err error) func(*fakeReader) {
	return func(f *fakeReader) {
		f.err = err
	}
}

func withItems(items []*annotations.ItemDTO) func(*fakeReader) {
	return func(f *fakeReader) {
		f.items = items
	}
}

func withTags(tags []*annotations.TagsDTO) func(*fakeReader) {
	return func(f *fakeReader) {
		f.tagRes = annotations.FindTagsResult{Tags: tags}
	}
}

func withGetFn(fn func(context.Context, *annotations.ItemQuery, *accesscontrol.AccessResources) ([]*annotations.ItemDTO, error)) func(*fakeReader) {
	return func(f *fakeReader) {
		f.getFn = fn
	}
}

func newFakeReader(opts ...func(*fakeReader)) *fakeReader {
	f := &fakeReader{}
	for _, opt := range opts {
		opt(f)
	}
	return f
}
