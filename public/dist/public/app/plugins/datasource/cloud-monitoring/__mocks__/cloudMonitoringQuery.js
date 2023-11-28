import { AlignmentTypes, QueryType, } from '../types/query';
export const createMockSLOQuery = (overrides) => {
    return Object.assign({ projectName: 'projectName', alignmentPeriod: 'cloud-monitoring-auto', perSeriesAligner: AlignmentTypes.ALIGN_MEAN, aliasBy: '', selectorName: 'select_slo_health', serviceId: '', serviceName: '', sloId: '', sloName: '', lookbackPeriod: '' }, overrides);
};
export const createMockTimeSeriesList = (overrides) => {
    return Object.assign({ crossSeriesReducer: 'REDUCE_NONE', projectName: 'cloud-monitoring-default-project', filters: [], groupBys: [], view: 'FULL' }, overrides);
};
export const createMockTimeSeriesQuery = (overrides) => {
    return Object.assign({ query: '', projectName: 'cloud-monitoring-default-project' }, overrides);
};
export const createMockQuery = (overrides) => {
    return Object.assign(Object.assign({ datasource: {
            type: 'stackdriver',
            uid: 'abc',
        }, refId: 'cloudMonitoringRefId', queryType: QueryType.TIME_SERIES_LIST, intervalMs: 0, hide: false }, overrides), { sloQuery: createMockSLOQuery(overrides === null || overrides === void 0 ? void 0 : overrides.sloQuery), timeSeriesList: createMockTimeSeriesList(overrides === null || overrides === void 0 ? void 0 : overrides.timeSeriesList), timeSeriesQuery: createMockTimeSeriesQuery(overrides === null || overrides === void 0 ? void 0 : overrides.timeSeriesQuery) });
};
//# sourceMappingURL=cloudMonitoringQuery.js.map