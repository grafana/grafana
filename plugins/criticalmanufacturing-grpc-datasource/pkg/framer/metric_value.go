package framer

import (
	proto "cmf/grafana-datamanager-datasource/pkg/proto"

	"cmf/grafana-datamanager-datasource/pkg/models"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type MetricValue struct {
	*proto.GetMetricValueResponse
	Query models.MetricValueQuery
}

func (f MetricValue) Frames() (data.Frames, error) {
	return convertToDataFrames(f), nil
}
