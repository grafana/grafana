package grafanads

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/user"
)

type fakeStore struct {
	store.StorageService
	folders map[string]int // path -> row count
	listed  []string
}

func (f *fakeStore) List(_ context.Context, _ *user.SignedInUser, path string, _ int) (*store.StorageListFrame, error) {
	f.listed = append(f.listed, path)
	n, ok := f.folders[path]
	if !ok {
		return nil, nil
	}
	names := make([]string, n)
	return &store.StorageListFrame{Frame: data.NewFrame("", data.NewField("name", nil, names))}, nil
}

func TestListPublicStatic(t *testing.T) {
	ctx := context.Background()

	t.Run("prefers the build output", func(t *testing.T) {
		fs := &fakeStore{folders: map[string]int{
			"public-static/build/img/icons/marker": 2,
			"public-static/img/icons/marker":       5,
		}}
		s := &Service{store: fs, log: log.NewNopLogger()}
		frame, err := s.listPublicStatic(ctx, "img/icons/marker", 0)
		require.NoError(t, err)
		require.Equal(t, 2, frame.Rows())
		require.Equal(t, []string{"public-static/build/img/icons/marker"}, fs.listed)
	})

	t.Run("falls back to the source copy when the build output is missing", func(t *testing.T) {
		fs := &fakeStore{folders: map[string]int{"public-static/img/icons/marker": 5}}
		s := &Service{store: fs, log: log.NewNopLogger()}
		frame, err := s.listPublicStatic(ctx, "img/icons/marker", 0)
		require.NoError(t, err)
		require.Equal(t, 5, frame.Rows())
	})

	t.Run("lists nothing when neither copy exists", func(t *testing.T) {
		s := &Service{store: &fakeStore{}, log: log.NewNopLogger()}
		frame, err := s.listPublicStatic(ctx, "img/icons/marker", 0)
		require.NoError(t, err)
		require.Nil(t, frame)
	})

	t.Run("non-icon paths are untouched", func(t *testing.T) {
		fs := &fakeStore{folders: map[string]int{
			"public-static/build/img/bg": 9,
			"public-static/img/bg":       3,
		}}
		s := &Service{store: fs, log: log.NewNopLogger()}
		frame, err := s.listPublicStatic(ctx, "img/bg", 0)
		require.NoError(t, err)
		require.Equal(t, 3, frame.Rows())
	})
}
