import { __assign } from "tslib";
import { dateTime } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
import { GrafanaDatasource } from './datasource';
import { GrafanaAnnotationType } from './types';
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: function () { return backendSrv; }, getTemplateSrv: function () { return ({
        replace: function (val) {
            return val.replace('$var2', 'replaced__delimiter__replaced2').replace('$var', 'replaced');
        },
    }); } })); });
describe('grafana data source', function () {
    var getMock = jest.spyOn(backendSrv, 'get');
    beforeEach(function () {
        jest.clearAllMocks();
    });
    describe('when executing an annotations query', function () {
        var calledBackendSrvParams;
        var ds;
        beforeEach(function () {
            getMock.mockImplementation(function (url, options) {
                calledBackendSrvParams = options;
                return Promise.resolve([]);
            });
            ds = new GrafanaDatasource({});
        });
        describe('with tags that have template variables', function () {
            var options = setupAnnotationQueryOptions({ tags: ['tag1:$var'] });
            beforeEach(function () {
                return ds.getAnnotations(options);
            });
            it('should interpolate template variables in tags in query options', function () {
                expect(calledBackendSrvParams.tags[0]).toBe('tag1:replaced');
            });
        });
        describe('with tags that have multi value template variables', function () {
            var options = setupAnnotationQueryOptions({ tags: ['$var2'] });
            beforeEach(function () {
                return ds.getAnnotations(options);
            });
            it('should interpolate template variables in tags in query options', function () {
                expect(calledBackendSrvParams.tags[0]).toBe('replaced');
                expect(calledBackendSrvParams.tags[1]).toBe('replaced2');
            });
        });
        describe('with type dashboard', function () {
            var options = setupAnnotationQueryOptions({
                type: GrafanaAnnotationType.Dashboard,
                tags: ['tag1'],
            }, { id: 1 });
            beforeEach(function () {
                return ds.getAnnotations(options);
            });
            it('should remove tags from query options', function () {
                expect(calledBackendSrvParams.tags).toBe(undefined);
            });
        });
    });
});
function setupAnnotationQueryOptions(annotation, dashboard) {
    return {
        annotation: {
            target: annotation,
        },
        dashboard: dashboard,
        range: {
            from: dateTime(1432288354),
            to: dateTime(1432288401),
        },
        rangeRaw: { from: 'now-24h', to: 'now' },
    };
}
//# sourceMappingURL=datasource.test.js.map