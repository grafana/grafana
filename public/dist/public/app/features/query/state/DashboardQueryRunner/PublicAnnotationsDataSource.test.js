import { __awaiter } from "tslib";
import { of } from 'rxjs';
import { config } from '@grafana/runtime';
import { GRAFANA_DATASOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { GrafanaQueryType } from 'app/plugins/datasource/grafana/types';
import { PublicAnnotationsDataSource } from './PublicAnnotationsDataSource';
const mockDatasourceRequest = jest.fn();
const backendSrv = {
    fetch: (options) => {
        return of(mockDatasourceRequest(options));
    },
    get: (url, options) => {
        return mockDatasourceRequest(url, options);
    },
};
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: () => backendSrv, getDataSourceSrv: () => {
        return {
            getInstanceSettings: (ref) => { var _a, _b; return ({ type: (_a = ref === null || ref === void 0 ? void 0 : ref.type) !== null && _a !== void 0 ? _a : '?', uid: (_b = ref === null || ref === void 0 ? void 0 : ref.uid) !== null && _b !== void 0 ? _b : '?' }); },
        };
    } })));
describe('PublicDashboardDatasource', () => {
    test('will add annotation query type to annotations', () => {
        const ds = new PublicAnnotationsDataSource();
        const annotationQuery = {
            enable: true,
            name: 'someName',
            iconColor: 'red',
        };
        // @ts-ignore
        const annotation = ds === null || ds === void 0 ? void 0 : ds.annotations.prepareQuery(annotationQuery);
        expect(annotation === null || annotation === void 0 ? void 0 : annotation.queryType).toEqual(GrafanaQueryType.Annotations);
    });
    test('fetches results from the pubdash annotations endpoint when it is an annotation query', () => __awaiter(void 0, void 0, void 0, function* () {
        mockDatasourceRequest.mockReset();
        mockDatasourceRequest.mockReturnValue(Promise.resolve([]));
        const ds = new PublicAnnotationsDataSource();
        const panelId = 1;
        config.publicDashboardAccessToken = 'abc123';
        yield ds.query({
            maxDataPoints: 10,
            intervalMs: 5000,
            targets: [
                {
                    refId: 'A',
                    datasource: { uid: GRAFANA_DATASOURCE_NAME, type: 'sample' },
                    queryType: GrafanaQueryType.Annotations,
                },
            ],
            panelId,
            range: { from: new Date().toLocaleString(), to: new Date().toLocaleString() },
        });
        const mock = mockDatasourceRequest.mock;
        expect(mock.calls.length).toBe(1);
        expect(mock.lastCall[0]).toEqual(`/api/public/dashboards/abc123/annotations`);
    }));
});
//# sourceMappingURL=PublicAnnotationsDataSource.test.js.map