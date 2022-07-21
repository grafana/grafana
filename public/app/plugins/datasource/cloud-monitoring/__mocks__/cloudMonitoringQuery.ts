import { AlignmentTypes, CloudMonitoringQuery, EditorMode, MetricQuery, QueryType, SLOQuery } from '../types';

export const createMockMetricQuery: (overrides?: Partial<MetricQuery>) => MetricQuery = (
  overrides?: Partial<MetricQuery>
) => {
  return {
    editorMode: EditorMode.Visual,
    metricType: '',
    crossSeriesReducer: 'REDUCE_NONE',
    query: '',
    projectName: 'cloud-monitoring-default-project',
    ...overrides,
  };
};

export const createMockSLOQuery: (overrides?: Partial<SLOQuery>) => SLOQuery = (overrides) => {
  return {
    projectName: 'projectName',
    alignmentPeriod: 'cloud-monitoring-auto',
    perSeriesAligner: AlignmentTypes.ALIGN_MEAN,
    aliasBy: '',
    selectorName: 'select_slo_health',
    serviceId: '',
    serviceName: '',
    sloId: '',
    sloName: '',
    ...overrides,
  };
};

export const createMockQuery: (overrides?: Partial<CloudMonitoringQuery>) => CloudMonitoringQuery = (overrides) => {
  return {
    refId: 'cloudMonitoringRefId',
    queryType: QueryType.METRICS,
    intervalMs: 0,
    type: 'timeSeriesQuery',
    ...overrides,
    metricQuery: createMockMetricQuery(overrides?.metricQuery),
    sloQuery: createMockSLOQuery(overrides?.sloQuery),
  };
};
