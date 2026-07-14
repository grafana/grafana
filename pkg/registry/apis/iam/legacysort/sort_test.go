package legacysort

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func newSortOption(name string, index int) model.SortOption {
	return model.SortOption{Name: name, Index: index}
}

func TestConvertToSortOptions(t *testing.T) {
	fieldMapping := map[string]string{
		"title":        "name",
		"fields.email": "email",
	}

	sortOptions := map[string]model.SortOption{
		"name-asc":   newSortOption("name-asc", 0),
		"name-desc":  newSortOption("name-desc", 0),
		"email-asc":  newSortOption("email-asc", 1),
		"email-desc": newSortOption("email-desc", 1),
	}

	t.Run("maps title to name ascending", func(t *testing.T) {
		sortBy := []*resourcepb.ResourceSearchRequest_Sort{
			{Field: "title", Desc: false},
		}
		opts := ConvertToSortOptions(sortBy, fieldMapping, sortOptions)
		require.Len(t, opts, 1)
		require.Equal(t, "name-asc", opts[0].Name)
	})

	t.Run("maps title to name descending", func(t *testing.T) {
		sortBy := []*resourcepb.ResourceSearchRequest_Sort{
			{Field: "title", Desc: true},
		}
		opts := ConvertToSortOptions(sortBy, fieldMapping, sortOptions)
		require.Len(t, opts, 1)
		require.Equal(t, "name-desc", opts[0].Name)
	})

	t.Run("maps prefixed field to email ascending", func(t *testing.T) {
		sortBy := []*resourcepb.ResourceSearchRequest_Sort{
			{Field: "fields.email", Desc: false},
		}
		opts := ConvertToSortOptions(sortBy, fieldMapping, sortOptions)
		require.Len(t, opts, 1)
		require.Equal(t, "email-asc", opts[0].Name)
	})

	t.Run("ignores unknown sort fields", func(t *testing.T) {
		sortBy := []*resourcepb.ResourceSearchRequest_Sort{
			{Field: "unknown", Desc: false},
		}
		opts := ConvertToSortOptions(sortBy, fieldMapping, sortOptions)
		require.Len(t, opts, 0)
	})

	t.Run("orders multiple sort fields by index", func(t *testing.T) {
		sortBy := []*resourcepb.ResourceSearchRequest_Sort{
			{Field: "fields.email", Desc: false},
			{Field: "title", Desc: true},
		}
		opts := ConvertToSortOptions(sortBy, fieldMapping, sortOptions)
		require.Len(t, opts, 2)
		require.Equal(t, "name-desc", opts[0].Name)
		require.Equal(t, "email-asc", opts[1].Name)
	})

	t.Run("returns empty for nil input", func(t *testing.T) {
		opts := ConvertToSortOptions(nil, fieldMapping, sortOptions)
		require.Len(t, opts, 0)
	})
}

func TestConvertToSortParams(t *testing.T) {
	fieldMapping := map[string]string{
		"title":        "name",
		"fields.email": "email",
	}

	t.Run("maps name ascending to title", func(t *testing.T) {
		sortOpts := []model.SortOption{newSortOption("name-asc", 0)}
		params := ConvertToSortParams(sortOpts, fieldMapping)
		require.Equal(t, []string{"title"}, params)
	})

	t.Run("maps name descending to -title", func(t *testing.T) {
		sortOpts := []model.SortOption{newSortOption("name-desc", 0)}
		params := ConvertToSortParams(sortOpts, fieldMapping)
		require.Equal(t, []string{"-title"}, params)
	})

	t.Run("maps email ascending and strips fields prefix", func(t *testing.T) {
		sortOpts := []model.SortOption{newSortOption("email-asc", 1)}
		params := ConvertToSortParams(sortOpts, fieldMapping)
		require.Equal(t, []string{"email"}, params)
	})

	t.Run("maps email descending", func(t *testing.T) {
		sortOpts := []model.SortOption{newSortOption("email-desc", 1)}
		params := ConvertToSortParams(sortOpts, fieldMapping)
		require.Equal(t, []string{"-email"}, params)
	})

	t.Run("maps multiple sort options", func(t *testing.T) {
		sortOpts := []model.SortOption{
			newSortOption("name-desc", 0),
			newSortOption("email-asc", 1),
		}
		params := ConvertToSortParams(sortOpts, fieldMapping)
		require.Equal(t, []string{"-title", "email"}, params)
	})

	t.Run("skips unmapped fields", func(t *testing.T) {
		sortOpts := []model.SortOption{newSortOption("member_count-desc", 2)}
		params := ConvertToSortParams(sortOpts, fieldMapping)
		require.Empty(t, params)
	})

	t.Run("skips malformed sort option name", func(t *testing.T) {
		sortOpts := []model.SortOption{newSortOption("invalid", 0)}
		params := ConvertToSortParams(sortOpts, fieldMapping)
		require.Empty(t, params)
	})

	t.Run("returns empty for nil input", func(t *testing.T) {
		params := ConvertToSortParams(nil, fieldMapping)
		require.Empty(t, params)
	})
}
