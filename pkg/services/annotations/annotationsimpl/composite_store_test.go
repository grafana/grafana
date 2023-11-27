package annotationsimpl

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/annotations/accesscontrol"
	"github.com/stretchr/testify/require"
)

var (
	errGet     = errors.New("get error")
	errGetTags = errors.New("get tags error")
)

func TestCompositeStore(t *testing.T) {
	t.Run("should join errors", func(t *testing.T) {
		err1 := errors.New("error 1")
		r1 := &fakeReader{err: err1}
		err2 := errors.New("error 2")
		r2 := &fakeReader{err: err2}

		store := &CompositeStore{
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
			require.ErrorIs(t, err, err2)
			require.ErrorIs(t, err, tt.err)
		}
	})

	t.Run("should combine and sort results from Get", func(t *testing.T) {
		items1 := []*annotations.ItemDTO{
			{TimeEnd: 1, Time: 2},
			{TimeEnd: 2, Time: 1},
		}
		r1 := &fakeReader{items: items1}

		items2 := []*annotations.ItemDTO{
			{TimeEnd: 1, Time: 1},
			{TimeEnd: 1, Time: 3},
		}
		r2 := &fakeReader{items: items2}

		store := &CompositeStore{
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
		r1 := &fakeReader{tagRes: annotations.FindTagsResult{Tags: tags1}}

		tags2 := []*annotations.TagsDTO{
			{Tag: "key1:val2"},
			{Tag: "key2:val2"},
		}
		r2 := &fakeReader{tagRes: annotations.FindTagsResult{Tags: tags2}}

		store := &CompositeStore{
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
	items  []*annotations.ItemDTO
	tagRes annotations.FindTagsResult
	err    error
}

func (f *fakeReader) Get(ctx context.Context, query *annotations.ItemQuery, accessResources *accesscontrol.AccessResources) ([]*annotations.ItemDTO, error) {
	if f.err != nil {
		err := fmt.Errorf("%w: %w", errGet, f.err)
		return nil, err
	}
	return f.items, nil
}

func (f *fakeReader) GetTags(ctx context.Context, query *annotations.TagsQuery) (annotations.FindTagsResult, error) {
	if f.err != nil {
		err := fmt.Errorf("%w: %w", errGetTags, f.err)
		return annotations.FindTagsResult{}, err
	}
	return f.tagRes, nil
}
