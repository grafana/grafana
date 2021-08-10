package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type AutoJsonConverter struct {
	FieldTips map[string]Field
}

func NewAutoJsonConverter(fieldTips map[string]Field) *AutoJsonConverter {
	return &AutoJsonConverter{FieldTips: fieldTips}
}

// Automatic conversion works this way:
// * Time added automatically
// * Nulls dropped
// To preserve nulls and extract time we need tips from a user:
// * Field types
// * Time column with time format
func (c *AutoJsonConverter) Convert(_ context.Context, vars Vars, data []byte) (*data.Frame, error) {
	return JSONDocToFrame(vars.Path, data, c.FieldTips)
}
