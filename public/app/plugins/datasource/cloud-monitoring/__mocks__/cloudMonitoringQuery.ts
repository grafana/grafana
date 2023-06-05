import { AlignmentTypes, CloudMonitoringQuery, QueryType, SLOQuery, TimeSeriesList, TimeSeriesQuery } from '../types';

type Subset<K> = {
  [attr in keyof K]?: K[attr] extends object ? Subset<K[attr]> : K[attr];
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

export const createMockTimeSeriesList: (overrides?: Partial<TimeSeriesList>) => TimeSeriesList = (
  overrides?: Partial<TimeSeriesList>
) => {
  return {
    crossSeriesReducer: 'REDUCE_NONE',
    projectName: 'cloud-monitoring-default-project',
    filters: [],
    groupBys: [],
    view: 'FULL',
    ...overrides,
  };
};

export const createMockTimeSeriesQuery: (overrides?: Partial<TimeSeriesQuery>) => TimeSeriesQuery = (
  overrides?: Partial<TimeSeriesQuery>
) => {
  return {
    query: '',
    projectName: 'cloud-monitoring-default-project',
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
    queryType: QueryType.TIME_SERIES_LIST,
    intervalMs: 0,
    hide: false,
    ...overrides,
    sloQuery: createMockSLOQuery(overrides?.sloQuery),
    timeSeriesList: createMockTimeSeriesList(overrides?.timeSeriesList),
    timeSeriesQuery: createMockTimeSeriesQuery(overrides?.timeSeriesQuery),
  };
};
