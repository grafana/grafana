package mocks

import (
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
)

type AnnotationServiceMock struct {
	CallsGetAlarmNamesByMetric         []*models.AnnotationQuery
	CallsGetAlarmNamesByPrefixMatching []*models.AnnotationQuery
}

// GetAnnotationEvents implements models.AnnotationProvider
func (s *AnnotationServiceMock) GetAnnotationEvents(timeRange backend.TimeRange, alarmNames []*string) (models.AnnotationEvents, error) {
	return models.AnnotationEvents{}, nil
}

func (a *AnnotationServiceMock) GetAlarmNamesByMetric(query *models.AnnotationQuery) ([]*string, error) {
	a.CallsGetAlarmNamesByMetric = append(a.CallsGetAlarmNamesByMetric, query)

	return nil, nil
}

func (a *AnnotationServiceMock) GetAlarmNamesByPrefixMatching(query *models.AnnotationQuery) ([]*string, error) {
	a.CallsGetAlarmNamesByPrefixMatching = append(a.CallsGetAlarmNamesByPrefixMatching, query)

	return nil, nil
}
