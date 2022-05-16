import { CloudMonitoringQuery, EditorMode, MetricQuery, QueryType } from '../types';

export const createMockMetricQuery: () => MetricQuery = () => {
  return {
    editorMode: EditorMode.Visual,
    metricType: '',
    crossSeriesReducer: 'REDUCE_NONE',
    query: '',
    projectName: 'cloud-monitoring-default-project',
  };
};

export const createMockQuery: () => CloudMonitoringQuery = () => {
  return {
    refId: 'cloudMonitoringRefId',
    queryType: QueryType.METRICS,
    intervalMs: 0,
    type: 'timeSeriesQuery',
    metricQuery: createMockMetricQuery(),
  };
};
