package handlers

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/services"
)

func AnnotationHandler(ctx context.Context, req *backend.QueryDataRequest, q backend.DataQuery, reqCtxFactory models.RequestContextFactoryFunc) backend.DataResponse {
	annotationQuery, err := models.GetAnnotationQuery(&q)
	if err != nil {
		return models.DataResponseErrorUnmarshal(err)
	}

	service, err := newService(req.PluginContext, reqCtxFactory, annotationQuery.Region)
	if err != nil {
		return models.DataResponseErrorRequestFailed(err)
	}

	alarmNamesGetterFunc := service.GetAlarmNamesByPrefixMatching
	if !annotationQuery.PrefixMatching {
		if annotationQuery.Region == "" || annotationQuery.Namespace == "" || annotationQuery.MetricName == "" || annotationQuery.Statistic == "" {
			return models.DataResponseErrorBadRequest("Region, Namespace, MetricName and Statistic are required")
		}

		alarmNamesGetterFunc = service.GetAlarmNamesByMetric
	}

	alarmNames, err := alarmNamesGetterFunc(annotationQuery)
	if err != nil {
		return models.DataResponseErrorRequestFailed(err)
	}

	annationEvents, err := service.GetAnnotationEvents(q.TimeRange, alarmNames)
	if err != nil {
		return models.DataResponseErrorRequestFailed(err)
	}

	return backend.DataResponse{
		Frames: annationEvents.Frames(q.RefID),
		Error:  nil,
	}
}

// newService is an annotation service factory.
//
// Stubbable by tests.
var newService = func(pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, region string) (models.AnnotationProvider, error) {
	reqCtx, err := reqCtxFactory(pluginCtx, region)
	if err != nil {
		return nil, err
	}

	return services.NewAnnotationService(reqCtx.MetricsClientProvider), nil
}
