import { map, of } from 'rxjs';
import { LoadingState } from '@grafana/data';
import { PublicAnnotationsDataSource } from 'app/features/query/state/DashboardQueryRunner/PublicAnnotationsDataSource';
import { DashboardAnnotationsDataLayer } from './DashboardAnnotationsDataLayer';
const getDataSourceSrvSpy = jest.fn();
const runRequestMock = jest.fn().mockImplementation((ds, request) => {
    const result = {
        state: LoadingState.Loading,
        series: [],
        timeRange: request.range,
    };
    return of([]).pipe(map(() => {
        result.state = LoadingState.Done;
        result.series = [];
        return result;
    }));
});
jest.mock('app/features/query/state/DashboardQueryRunner/PublicAnnotationsDataSource');
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getDataSourceSrv: () => {
        getDataSourceSrvSpy();
    }, getRunRequest: () => (ds, request) => {
        return runRequestMock(ds, request);
    }, config: {
        publicDashboardAccessToken: 'ac123',
    } })));
describe('DashboardAnnotationsDataLayer', () => {
    it('should use PublicAnnotationsDataSource when config.publicDashboardAccessToken is set', () => {
        const dataLayer = new DashboardAnnotationsDataLayer({
            name: 'Annotations & Alerts',
            query: {
                builtIn: 1,
                datasource: {
                    type: 'grafana',
                    uid: '-- Grafana --',
                },
                enable: true,
                hide: true,
                iconColor: 'rgba(0, 211, 255, 1)',
                name: 'Annotations & Alerts',
                target: {
                    // @ts-expect-error
                    limit: 100,
                    matchAny: false,
                    tags: [],
                    type: 'dashboard',
                },
                type: 'dashboard',
            },
        });
        dataLayer.activate();
        expect(PublicAnnotationsDataSource).toHaveBeenCalledTimes(1);
        expect(getDataSourceSrvSpy).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=DashboardAnnotationsDataLayer.test.js.map