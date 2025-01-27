package parquet

import (
	"github.com/apache/arrow-go/v18/arrow"
)

func newSchema(metadata *arrow.Metadata) *arrow.Schema {
	return arrow.NewSchema([]arrow.Field{
		{Name: "resource_version", Type: &arrow.Int64Type{}, Nullable: false},
		{Name: "group", Type: &arrow.StringType{}, Nullable: false},
		{Name: "resource", Type: &arrow.StringType{}, Nullable: false},
		{Name: "namespace", Type: &arrow.StringType{}, Nullable: false},
		{Name: "name", Type: &arrow.StringType{}, Nullable: false},
		{Name: "folder", Type: &arrow.StringType{}, Nullable: false},
		{Name: "action", Type: &arrow.Int8Type{}, Nullable: false}, // 1,2,3
		{Name: "value", Type: &arrow.StringType{}, Nullable: false},
	}, metadata)
}
