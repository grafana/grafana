package annotationsapi

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/annotations"
)

func TestMerge(t *testing.T) {
	item := func(id, timeEnd int64) *annotations.ItemDTO {
		return &annotations.ItemDTO{ID: id, TimeEnd: timeEnd}
	}

	tests := []struct {
		name   string
		new    []*annotations.ItemDTO
		legacy []*annotations.ItemDTO
		limit  int64
		want   []*annotations.ItemDTO
	}{
		{
			name:   "both empty",
			new:    nil,
			legacy: nil,
			limit:  10,
			want:   []*annotations.ItemDTO{},
		},
		{
			name:   "duplicate ID - new store wins, no duplicate",
			new:    []*annotations.ItemDTO{item(1, 10)},
			legacy: []*annotations.ItemDTO{item(1, 10), item(2, 20)},
			limit:  10,
			want:   []*annotations.ItemDTO{item(2, 20), item(1, 10)},
		},
		{
			name:   "Time used as tiebreaker when TimeEnd equal",
			new:    []*annotations.ItemDTO{{ID: 1, TimeEnd: 10, Time: 1}, {ID: 2, TimeEnd: 10, Time: 3}},
			legacy: []*annotations.ItemDTO{{ID: 3, TimeEnd: 10, Time: 2}},
			limit:  10,
			want:   []*annotations.ItemDTO{{ID: 2, TimeEnd: 10, Time: 3}, {ID: 3, TimeEnd: 10, Time: 2}, {ID: 1, TimeEnd: 10, Time: 1}},
		},
		{
			name:   "limit applied after sort",
			new:    []*annotations.ItemDTO{item(1, 30), item(2, 20)},
			legacy: []*annotations.ItemDTO{item(3, 10)},
			limit:  2,
			want:   []*annotations.ItemDTO{item(1, 30), item(2, 20)},
		},
		{
			name:   "limit=0 means no limit",
			new:    []*annotations.ItemDTO{item(1, 30), item(2, 20)},
			legacy: []*annotations.ItemDTO{item(3, 10)},
			limit:  0,
			want:   []*annotations.ItemDTO{item(1, 30), item(2, 20), item(3, 10)},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Merge(tt.new, tt.legacy, tt.limit)
			require.Equal(t, tt.want, got)
		})
	}
}
