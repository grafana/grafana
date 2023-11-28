import { dateTime } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__
import { GrafanaDatasource } from './datasource';
import { GrafanaAnnotationType } from './types';
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: () => backendSrv, getTemplateSrv: () => ({
        replace: (val) => {
            return val.replace('$var2', 'replaced__delimiter__replaced2').replace('$var', 'replaced');
        },
    }) })));
describe('grafana data source', () => {
    const getMock = jest.spyOn(backendSrv, 'get');
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('when executing an annotations query', () => {
        let calledBackendSrvParams;
        let ds;
        beforeEach(() => {
            getMock.mockImplementation((url, options) => {
                calledBackendSrvParams = options;
                return Promise.resolve([]);
            });
            ds = new GrafanaDatasource({});
        });
        describe('with tags that have template variables', () => {
            const options = setupAnnotationQueryOptions({ tags: ['tag1:$var'] });
            beforeEach(() => {
                return ds.getAnnotations(options);
            });
            it('should interpolate template variables in tags in query options', () => {
                expect(calledBackendSrvParams.tags[0]).toBe('tag1:replaced');
            });
        });
        describe('with tags that have multi value template variables', () => {
            const options = setupAnnotationQueryOptions({ tags: ['$var2'] });
            beforeEach(() => {
                return ds.getAnnotations(options);
            });
            it('should interpolate template variables in tags in query options', () => {
                expect(calledBackendSrvParams.tags[0]).toBe('replaced');
                expect(calledBackendSrvParams.tags[1]).toBe('replaced2');
            });
        });
        describe('with type dashboard', () => {
            const options = setupAnnotationQueryOptions({
                type: GrafanaAnnotationType.Dashboard,
                tags: ['tag1'],
            }, { uid: 'DSNdW0gVk' });
            beforeEach(() => {
                return ds.getAnnotations(options);
            });
            it('should remove tags from query options', () => {
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
        dashboard,
        range: {
            from: dateTime(1432288354),
            to: dateTime(1432288401),
        },
        rangeRaw: { from: 'now-24h', to: 'now' },
    };
}
//# sourceMappingURL=datasource.test.js.map