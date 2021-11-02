import { __assign } from "tslib";
import { MetaAnalyticsEventName, reportMetaAnalytics } from '@grafana/runtime';
import { CoreApp, dateTime, LoadingState } from '@grafana/data';
import { emitDataRequestEvent } from './queryAnalytics';
import { DashboardModel } from '../../dashboard/state/DashboardModel';
beforeEach(function () {
    jest.clearAllMocks();
});
var datasource = {
    name: 'test',
    id: 1,
};
var dashboardModel = new DashboardModel({ id: 1, title: 'Test Dashboard', uid: 'test' }, { folderTitle: 'Test Folder' });
jest.mock('app/features/dashboard/services/DashboardSrv', function () { return ({
    getDashboardSrv: function () {
        return {
            getCurrent: function () { return dashboardModel; },
        };
    },
}); });
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { reportMetaAnalytics: jest.fn() })); });
var mockGetUrlSearchParams = jest.fn(function () {
    return {};
});
jest.mock('@grafana/data', function () { return (__assign(__assign({}, jest.requireActual('@grafana/data')), { urlUtil: {
        getUrlSearchParams: function () { return mockGetUrlSearchParams(); },
    } })); });
function getTestData(requestApp) {
    var now = dateTime();
    return {
        request: {
            app: requestApp,
            dashboardId: 1,
            panelId: 2,
            startTime: now.unix(),
            endTime: now.add(1, 's').unix(),
        },
        series: [],
        state: LoadingState.Done,
        timeRange: {
            from: dateTime(),
            to: dateTime(),
            raw: { from: '1h', to: 'now' },
        },
    };
}
describe('emitDataRequestEvent - from a dashboard panel', function () {
    var data = getTestData(CoreApp.Dashboard);
    var fn = emitDataRequestEvent(datasource);
    it('Should report meta analytics', function () {
        fn(data);
        expect(reportMetaAnalytics).toBeCalledTimes(1);
        expect(reportMetaAnalytics).toBeCalledWith(expect.objectContaining({
            eventName: MetaAnalyticsEventName.DataRequest,
            datasourceName: datasource.name,
            datasourceId: datasource.id,
            panelId: 2,
            dashboardId: 1,
            dashboardName: 'Test Dashboard',
            dashboardUid: 'test',
            folderName: 'Test Folder',
            dataSize: 0,
            duration: 1,
        }));
    });
    it('Should not report meta analytics twice if the request receives multiple responses', function () {
        fn(data);
        expect(reportMetaAnalytics).not.toBeCalled();
    });
    it('Should not report meta analytics in edit mode', function () {
        mockGetUrlSearchParams.mockImplementationOnce(function () {
            return { editPanel: 2 };
        });
        emitDataRequestEvent(datasource)(data);
        expect(reportMetaAnalytics).not.toBeCalled();
    });
});
describe('emitDataRequestEvent - from Explore', function () {
    var data = getTestData(CoreApp.Explore);
    it('Should not report meta analytics', function () {
        emitDataRequestEvent(datasource)(data);
        expect(reportMetaAnalytics).not.toBeCalled();
    });
});
//# sourceMappingURL=queryAnalytics.test.js.map