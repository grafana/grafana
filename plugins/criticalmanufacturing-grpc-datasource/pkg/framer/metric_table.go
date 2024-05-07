package framer

import (
	proto "cmf/grafana-datamanager-datasource/pkg/proto"

	"cmf/grafana-datamanager-datasource/pkg/models"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type MetricTable struct {
	*proto.GetMetricTableResponse
	Query models.MetricTableQuery
}

func (f MetricTable) Frames() (data.Frames, error) {
	return convertToDataFrames(f), nil
}
