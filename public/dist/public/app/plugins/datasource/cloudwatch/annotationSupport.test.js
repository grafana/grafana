import { CloudWatchAnnotationSupport } from './annotationSupport';
const metricStatAnnotationQuery = {
    queryMode: 'Annotations',
    region: 'us-east-2',
    namespace: 'AWS/EC2',
    period: '300',
    metricName: 'CPUUtilization',
    dimensions: { InstanceId: 'i-123' },
    matchExact: true,
    statistic: 'Average',
    refId: 'anno',
    prefixMatching: false,
    actionPrefix: '',
    alarmNamePrefix: '',
};
const prefixMatchingAnnotationQuery = {
    queryMode: 'Annotations',
    region: 'us-east-2',
    namespace: '',
    period: '300',
    metricName: '',
    dimensions: undefined,
    statistic: 'Average',
    refId: 'anno',
    prefixMatching: true,
    actionPrefix: 'arn',
    alarmNamePrefix: 'test-alarm',
};
const annotationQuery = {
    name: 'Anno',
    enable: false,
    iconColor: '',
    target: metricStatAnnotationQuery,
};
const legacyAnnotationQuery = {
    name: 'Anno',
    enable: false,
    iconColor: '',
    region: '',
    namespace: 'AWS/EC2',
    period: '300',
    metricName: 'CPUUtilization',
    dimensions: { InstanceId: 'i-123' },
    matchExact: true,
    statistic: '',
    refId: '',
    prefixMatching: false,
    actionPrefix: '',
    alarmNamePrefix: '',
    target: {
        limit: 0,
        matchAny: false,
        tags: [],
        type: '',
    },
    alias: '',
    builtIn: 0,
    datasource: undefined,
    expression: '',
    hide: false,
    id: '',
    type: '',
    statistics: [],
};
describe('annotationSupport', () => {
    describe('when prepareAnnotation', () => {
        describe('is being called with new style annotations', () => {
            it('should return the same query without changing it', () => {
                const preparedAnnotation = CloudWatchAnnotationSupport.prepareAnnotation(annotationQuery);
                expect(preparedAnnotation).toEqual(annotationQuery);
            });
        });
        describe('is being called with legacy annotations', () => {
            it('should return a new query', () => {
                const preparedAnnotation = CloudWatchAnnotationSupport.prepareAnnotation(legacyAnnotationQuery);
                expect(preparedAnnotation).not.toEqual(annotationQuery);
            });
            it('should set default values if not given', () => {
                var _a, _b, _c, _d;
                const preparedAnnotation = CloudWatchAnnotationSupport.prepareAnnotation(legacyAnnotationQuery);
                expect((_a = preparedAnnotation.target) === null || _a === void 0 ? void 0 : _a.statistic).toEqual('Average');
                expect((_b = preparedAnnotation.target) === null || _b === void 0 ? void 0 : _b.region).toEqual('default');
                expect((_c = preparedAnnotation.target) === null || _c === void 0 ? void 0 : _c.queryMode).toEqual('Annotations');
                expect((_d = preparedAnnotation.target) === null || _d === void 0 ? void 0 : _d.refId).toEqual('annotationQuery');
            });
            it('should not set default values if given', () => {
                var _a, _b, _c, _d;
                const annotation = CloudWatchAnnotationSupport.prepareAnnotation(Object.assign(Object.assign({}, legacyAnnotationQuery), { statistic: 'Min', region: 'us-east-2', queryMode: 'Annotations', refId: 'A' }));
                expect((_a = annotation.target) === null || _a === void 0 ? void 0 : _a.statistic).toEqual('Min');
                expect((_b = annotation.target) === null || _b === void 0 ? void 0 : _b.region).toEqual('us-east-2');
                expect((_c = annotation.target) === null || _c === void 0 ? void 0 : _c.queryMode).toEqual('Annotations');
                expect((_d = annotation.target) === null || _d === void 0 ? void 0 : _d.refId).toEqual('A');
            });
        });
    });
    describe('when prepareQuery', () => {
        describe('is being called without a target', () => {
            it('should return undefined', () => {
                const preparedQuery = CloudWatchAnnotationSupport.prepareQuery(Object.assign(Object.assign({}, annotationQuery), { target: undefined }));
                expect(preparedQuery).toBeUndefined();
            });
        });
        describe('is being called with a complete metric stat query', () => {
            it('should return the annotation target', () => {
                expect(CloudWatchAnnotationSupport.prepareQuery(annotationQuery)).toEqual(annotationQuery.target);
            });
        });
        describe('is being called with an incomplete metric stat query', () => {
            it('should return undefined', () => {
                const preparedQuery = CloudWatchAnnotationSupport.prepareQuery(Object.assign(Object.assign({}, annotationQuery), { target: Object.assign(Object.assign({}, annotationQuery.target), { dimensions: {}, metricName: '', statistic: undefined }) }));
                expect(preparedQuery).toBeUndefined();
            });
        });
        describe('is being called with an incomplete prefix matching query', () => {
            it('should return the annotation target', () => {
                const query = Object.assign(Object.assign({}, annotationQuery), { target: prefixMatchingAnnotationQuery });
                expect(CloudWatchAnnotationSupport.prepareQuery(query)).toEqual(query.target);
            });
        });
        describe('is being called with an incomplete prefix matching query', () => {
            it('should return undefined', () => {
                const query = Object.assign(Object.assign({}, annotationQuery), { target: Object.assign(Object.assign({}, prefixMatchingAnnotationQuery), { actionPrefix: '' }) });
                expect(CloudWatchAnnotationSupport.prepareQuery(query)).toBeUndefined();
            });
        });
    });
});
//# sourceMappingURL=annotationSupport.test.js.map