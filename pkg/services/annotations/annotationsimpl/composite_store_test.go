package annotationsimpl

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/services/annotations"
	mock "github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestCompositeStore_Get(t *testing.T) {
	t.Run("should join errors", func(t *testing.T) {
		primary := newFakeStore(t)
		historian := newFakeStore(t)
		ctx := context.Background()

		pErr := errors.New("primary error")
		hErr := errors.New("historian error")

		primary.EXPECT().Get(ctx, mock.Anything, mock.Anything).Return(nil, pErr)
		historian.EXPECT().Get(ctx, mock.Anything, mock.Anything).Return(nil, hErr)

		store := &CompositeStore{
			primary:   primary,
			historian: historian,
		}

		_, err := store.Get(ctx, nil, nil)
		require.Error(t, err)
		require.ErrorIs(t, err, pErr)
		require.ErrorIs(t, err, hErr)
	})

	t.Run("should sort and combine results from primary and historian", func(t *testing.T) {
		primary := newFakeStore(t)
		historian := newFakeStore(t)
		ctx := context.Background()

		primaryItems := []*annotations.ItemDTO{
			{TimeEnd: 1, Time: 2},
			{TimeEnd: 2, Time: 1},
		}
		primary.EXPECT().Get(ctx, mock.Anything, mock.Anything).Return(primaryItems, nil)

		historianItems := []*annotations.ItemDTO{
			{TimeEnd: 1, Time: 1},
			{TimeEnd: 1, Time: 3},
		}
		historian.EXPECT().Get(ctx, mock.Anything, mock.Anything).Return(historianItems, nil)

		store := &CompositeStore{
			primary:   primary,
			historian: historian,
		}

		expected := []*annotations.ItemDTO{
			{TimeEnd: 2, Time: 1},
			{TimeEnd: 1, Time: 3},
			{TimeEnd: 1, Time: 2},
			{TimeEnd: 1, Time: 1},
		}

		items, _ := store.Get(ctx, nil, nil)
		require.Equal(t, expected, items)
	})
}
