import { createMockDatasource } from './__mocks__/cloudMonitoringDatasource';
import { CloudMonitoringAnnotationSupport } from './annotationSupport';
import { AlignmentTypes, QueryType, MetricKind, } from './types/query';
const query = {
    refId: 'query',
    queryType: QueryType.ANNOTATION,
    intervalMs: 0,
    timeSeriesList: {
        projectName: 'project-name',
        filters: [],
        title: '',
        text: '',
        crossSeriesReducer: 'REDUCE_NONE',
        perSeriesAligner: AlignmentTypes.ALIGN_NONE,
    },
};
const legacyQuery = {
    projectName: 'project-name',
    metricType: 'metric-type',
    filters: ['filter1', 'filter2'],
    metricKind: MetricKind.CUMULATIVE,
    valueType: 'value-type',
    refId: 'annotationQuery',
    title: 'title',
    text: 'text',
};
const annotationQuery = {
    name: 'Anno',
    enable: false,
    iconColor: '',
    target: query,
};
const legacyAnnotationQuery = {
    name: 'Anno',
    enable: false,
    iconColor: '',
    target: legacyQuery,
};
const ds = createMockDatasource();
const annotationSupport = CloudMonitoringAnnotationSupport(ds);
describe('CloudMonitoringAnnotationSupport', () => {
    describe('prepareAnnotation', () => {
        it('returns query if it is already a Cloud Monitoring annotation query', () => {
            var _a;
            expect((_a = annotationSupport.prepareAnnotation) === null || _a === void 0 ? void 0 : _a.call(annotationSupport, annotationQuery)).toBe(annotationQuery);
        });
        it('returns an updated query if it is a legacy Cloud Monitoring annotation query', () => {
            var _a;
            const expectedQuery = {
                datasource: undefined,
                enable: false,
                iconColor: '',
                name: 'Anno',
                target: {
                    intervalMs: 0,
                    timeSeriesList: {
                        crossSeriesReducer: 'REDUCE_NONE',
                        filters: ['filter1', 'filter2'],
                        perSeriesAligner: 'ALIGN_NONE',
                        projectName: 'project-name',
                        text: 'text',
                        title: 'title',
                    },
                    queryType: 'annotation',
                    refId: 'annotationQuery',
                },
            };
            expect((_a = annotationSupport.prepareAnnotation) === null || _a === void 0 ? void 0 : _a.call(annotationSupport, legacyAnnotationQuery)).toEqual(expectedQuery);
        });
    });
    describe('prepareQuery', () => {
        it('should ensure queryType is set to "annotation"', () => {
            var _a;
            const queryWithoutMetricsQueryType = Object.assign(Object.assign({}, annotationQuery), { queryType: 'blah' });
            expect((_a = annotationSupport.prepareQuery) === null || _a === void 0 ? void 0 : _a.call(annotationSupport, queryWithoutMetricsQueryType)).toEqual(expect.objectContaining({ queryType: QueryType.ANNOTATION }));
        });
        it('should ensure type is set "annotationQuery"', () => {
            var _a;
            const queryWithoutAnnotationQueryType = Object.assign(Object.assign({}, annotationQuery), { type: 'blah' });
            expect((_a = annotationSupport.prepareQuery) === null || _a === void 0 ? void 0 : _a.call(annotationSupport, queryWithoutAnnotationQueryType)).toEqual(expect.objectContaining({ type: 'annotationQuery' }));
        });
        it('should return undefined if there is no query', () => {
            var _a;
            const queryWithUndefinedTarget = Object.assign(Object.assign({}, annotationQuery), { target: undefined });
            expect((_a = annotationSupport.prepareQuery) === null || _a === void 0 ? void 0 : _a.call(annotationSupport, queryWithUndefinedTarget)).toBeUndefined();
        });
    });
});
//# sourceMappingURL=annotationSupport.test.js.map