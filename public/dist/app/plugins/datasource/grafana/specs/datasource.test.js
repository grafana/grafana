import { GrafanaDatasource } from '../datasource';
import q from 'q';
import moment from 'moment';
describe('grafana data source', function () {
    describe('when executing an annotations query', function () {
        var calledBackendSrvParams;
        var backendSrvStub = {
            get: function (url, options) {
                calledBackendSrvParams = options;
                return q.resolve([]);
            },
        };
        var templateSrvStub = {
            replace: function (val) {
                return val.replace('$var2', 'replaced__delimiter__replaced2').replace('$var', 'replaced');
            },
        };
        var ds = new GrafanaDatasource(backendSrvStub, q, templateSrvStub);
        describe('with tags that have template variables', function () {
            var options = setupAnnotationQueryOptions({ tags: ['tag1:$var'] });
            beforeEach(function () {
                return ds.annotationQuery(options);
            });
            it('should interpolate template variables in tags in query options', function () {
                expect(calledBackendSrvParams.tags[0]).toBe('tag1:replaced');
            });
        });
        describe('with tags that have multi value template variables', function () {
            var options = setupAnnotationQueryOptions({ tags: ['$var2'] });
            beforeEach(function () {
                return ds.annotationQuery(options);
            });
            it('should interpolate template variables in tags in query options', function () {
                expect(calledBackendSrvParams.tags[0]).toBe('replaced');
                expect(calledBackendSrvParams.tags[1]).toBe('replaced2');
            });
        });
        describe('with type dashboard', function () {
            var options = setupAnnotationQueryOptions({
                type: 'dashboard',
                tags: ['tag1'],
            }, { id: 1 });
            beforeEach(function () {
                return ds.annotationQuery(options);
            });
            it('should remove tags from query options', function () {
                expect(calledBackendSrvParams.tags).toBe(undefined);
            });
        });
    });
});
function setupAnnotationQueryOptions(annotation, dashboard) {
    return {
        annotation: annotation,
        dashboard: dashboard,
        range: {
            from: moment(1432288354),
            to: moment(1432288401),
        },
        rangeRaw: { from: 'now-24h', to: 'now' },
    };
}
//# sourceMappingURL=datasource.test.js.map