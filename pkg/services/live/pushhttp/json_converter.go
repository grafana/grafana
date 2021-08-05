package pushhttp

import (
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/live/pipeline"
)

type autoJsonConverter struct{}

// Automatic conversion works this way:
// * Time added automatically
// * Nulls dropped
// To preserve nulls and extract time we need tips from a user:
// * Field types
// * Time column with time format
func (c *autoJsonConverter) Convert(name string, data []byte, fields map[string]pipeline.Field) (*data.Frame, error) {
	return JSONDocToFrame(name, data, fields)
}

func newJSONConverter() *autoJsonConverter {
	return &autoJsonConverter{}
}
