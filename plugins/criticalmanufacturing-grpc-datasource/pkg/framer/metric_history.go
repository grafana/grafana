package framer

import (
	proto "cmf/grafana-datamanager-datasource/pkg/proto"

	"cmf/grafana-datamanager-datasource/pkg/models"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type MetricHistory struct {
	*proto.GetMetricHistoryResponse
	Query models.MetricHistoryQuery
}

func (f MetricHistory) Frames() (data.Frames, error) {
	return convertToDataFrames(f), nil
}
