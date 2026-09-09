package resource

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestDecodeSearchValues(t *testing.T) {
	fields := []*resourcepb.ResourceSearchField{
		{Name: "title", Type: resourcepb.ResourceSearchField_STRING},
		{Name: "counts", Type: resourcepb.ResourceSearchField_INT64, IsArray: true},
		{Name: "ratio", Type: resourcepb.ResourceSearchField_DOUBLE},
		{Name: "flags", Type: resourcepb.ResourceSearchField_BOOLEAN, IsArray: true},
		{Name: "created", Type: resourcepb.ResourceSearchField_DATE},
	}
	row := &resourcepb.ResourceSearchRow{Values: []*resourcepb.ResourceSearchValue{
		{FieldIndex: 0, StringValues: []string{"Dashboard"}},
		{FieldIndex: 1, Int64Values: []int64{1, 2}},
		{FieldIndex: 2, DoubleValues: []float64{0.5}},
		{FieldIndex: 3, BooleanValues: []bool{true, false}},
		{FieldIndex: 4, Int64Values: []int64{1234}},
	}}

	values, err := DecodeSearchValues(fields, row)
	require.NoError(t, err)
	assert.Equal(t, map[string]any{
		"title":   "Dashboard",
		"counts":  []int64{1, 2},
		"ratio":   0.5,
		"flags":   []bool{true, false},
		"created": int64(1234),
	}, values)
}

func TestDecodeSearchValuesRejectsMalformedRows(t *testing.T) {
	tests := []struct {
		name   string
		fields []*resourcepb.ResourceSearchField
		row    *resourcepb.ResourceSearchRow
		err    string
	}{
		{name: "nil row", err: "nil search result row"},
		{
			name:   "duplicate field",
			fields: []*resourcepb.ResourceSearchField{{Name: "title", Type: resourcepb.ResourceSearchField_STRING}},
			row: &resourcepb.ResourceSearchRow{Values: []*resourcepb.ResourceSearchValue{
				{FieldIndex: 0, StringValues: []string{"one"}},
				{FieldIndex: 0, StringValues: []string{"two"}},
			}},
			err: "duplicate field index 0",
		},
		{
			name:   "out of range",
			fields: []*resourcepb.ResourceSearchField{{Name: "title", Type: resourcepb.ResourceSearchField_STRING}},
			row:    &resourcepb.ResourceSearchRow{Values: []*resourcepb.ResourceSearchValue{{FieldIndex: 1}}},
			err:    "field index 1 is out of range",
		},
		{
			name:   "nil definition",
			fields: []*resourcepb.ResourceSearchField{nil},
			row:    &resourcepb.ResourceSearchRow{Values: []*resourcepb.ResourceSearchValue{{FieldIndex: 0}}},
			err:    "field index 0 has no definition",
		},
		{
			name:   "invalid scalar",
			fields: []*resourcepb.ResourceSearchField{{Name: "title", Type: resourcepb.ResourceSearchField_STRING}},
			row:    &resourcepb.ResourceSearchRow{Values: []*resourcepb.ResourceSearchValue{{FieldIndex: 0}}},
			err:    `field "title": scalar has 0 values`,
		},
		{
			name:   "unsupported type",
			fields: []*resourcepb.ResourceSearchField{{Name: "title"}},
			row:    &resourcepb.ResourceSearchRow{Values: []*resourcepb.ResourceSearchValue{{FieldIndex: 0}}},
			err:    `field "title": unsupported type UNSPECIFIED`,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := DecodeSearchValues(test.fields, test.row)
			require.EqualError(t, err, test.err)
		})
	}
}
