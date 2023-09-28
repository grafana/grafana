package sortopts

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSorter_Filters(t *testing.T) {
	require.Equal(t, SortOptionsByQueryParam["name-asc"].Filter[0].OrderBy(), "LOWER(team.name) ASC")
	require.Equal(t, SortOptionsByQueryParam["name-desc"].Filter[0].OrderBy(), "LOWER(team.name) DESC")
	require.Equal(t, SortOptionsByQueryParam["email-asc"].Filter[0].OrderBy(), "team.email ASC")
	require.Equal(t, SortOptionsByQueryParam["email-desc"].Filter[0].OrderBy(), "team.email DESC")
	require.Equal(t, SortOptionsByQueryParam["memberCount-asc"].Filter[0].OrderBy(), "member_count ASC")
	require.Equal(t, SortOptionsByQueryParam["memberCount-desc"].Filter[0].OrderBy(), "member_count DESC")
}

func TestSorter_OrderBy(t *testing.T) {
	type fields struct {
		Field         string
		LowerCase     bool
		Descending    bool
		WithTableName bool
	}
	tests := []struct {
		name   string
		fields fields
		want   string
	}{
		{
			name: "team.email case sensitive desc",
			fields: fields{
				Field:         "email",
				LowerCase:     false,
				Descending:    true,
				WithTableName: true,
			},
			want: "team.email DESC",
		},
		{
			name: "member_count sensitive desc",
			fields: fields{
				Field:         "member_count",
				LowerCase:     false,
				Descending:    true,
				WithTableName: false,
			},
			want: "member_count DESC",
		},
		{
			name: "team.name case insensitive asc",
			fields: fields{
				Field:         "name",
				LowerCase:     true,
				Descending:    false,
				WithTableName: true,
			},
			want: "LOWER(team.name) ASC",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := Sorter{
				Field:         tt.fields.Field,
				LowerCase:     tt.fields.LowerCase,
				Descending:    tt.fields.Descending,
				WithTableName: tt.fields.WithTableName,
			}

			got := s.OrderBy()
			require.Equal(t, tt.want, got)
		})
	}
}
