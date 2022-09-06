import { AlignmentTypes, CloudMonitoringQuery, EditorMode, MetricQuery, QueryType, SLOQuery } from '../types';

type Subset<K> = {
  [attr in keyof K]?: K[attr] extends object ? Subset<K[attr]> : K[attr];
};

export const createMockMetricQuery: (overrides?: Partial<MetricQuery>) => MetricQuery = (
  overrides?: Partial<MetricQuery>
) => {
  return {
    editorMode: EditorMode.Visual,
    metricType: '',
    crossSeriesReducer: 'REDUCE_NONE',
    query: '',
    projectName: 'cloud-monitoring-default-project',
    filters: [],
    groupBys: [],
    view: 'FULL',
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
    lookbackPeriod: '',
    ...overrides,
  };
};

export const createMockQuery: (overrides?: Subset<CloudMonitoringQuery>) => CloudMonitoringQuery = (overrides) => {
  return {
    datasource: {
      type: 'stackdriver',
      uid: 'abc',
    },
    refId: 'cloudMonitoringRefId',
    queryType: QueryType.METRICS,
    intervalMs: 0,
    type: 'timeSeriesQuery',
    hide: false,
    ...overrides,
    metricQuery: createMockMetricQuery(overrides?.metricQuery),
    sloQuery: createMockSLOQuery(overrides?.sloQuery),
  };
};
