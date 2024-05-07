package framer

import (
	proto "cmf/grafana-datamanager-datasource/pkg/proto"

	"cmf/grafana-datamanager-datasource/pkg/models"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type MetricAggregate struct {
	*proto.GetMetricAggregateResponse
	Query models.MetricAggregateQuery
}

func (f MetricAggregate) Frames() (data.Frames, error) {
	return convertToDataFrames(f), nil
}
