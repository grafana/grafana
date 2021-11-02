import { __assign, __awaiter, __generator } from "tslib";
import { restore, versions } from './__mocks__/dashboardHistoryMocks';
import { HistorySrv } from './HistorySrv';
import { DashboardModel } from '../../state/DashboardModel';
var getMock = jest.fn().mockResolvedValue({});
var postMock = jest.fn().mockResolvedValue({});
jest.mock('app/core/store');
jest.mock('@grafana/runtime', function () {
    var original = jest.requireActual('@grafana/runtime');
    return __assign(__assign({}, original), { getBackendSrv: function () { return ({
            post: postMock,
            get: getMock,
        }); } });
});
describe('historySrv', function () {
    var versionsResponse = versions();
    var restoreResponse = restore;
    var historySrv = new HistorySrv();
    var dash = new DashboardModel({ id: 1 });
    var emptyDash = new DashboardModel({});
    var historyListOpts = { limit: 10, start: 0 };
    beforeEach(function () {
        jest.clearAllMocks();
    });
    describe('getHistoryList', function () {
        it('should return a versions array for the given dashboard id', function () {
            getMock.mockImplementation(function () { return Promise.resolve(versionsResponse); });
            historySrv = new HistorySrv();
            return historySrv.getHistoryList(dash, historyListOpts).then(function (versions) {
                expect(versions).toEqual(versionsResponse);
            });
        });
        it('should return an empty array when not given an id', function () {
            return historySrv.getHistoryList(emptyDash, historyListOpts).then(function (versions) {
                expect(versions).toEqual([]);
            });
        });
        it('should return an empty array when not given a dashboard', function () {
            return historySrv.getHistoryList(null, historyListOpts).then(function (versions) {
                expect(versions).toEqual([]);
            });
        });
    });
    describe('restoreDashboard', function () {
        it('should return a success response given valid parameters', function () {
            var version = 6;
            postMock.mockImplementation(function () { return Promise.resolve(restoreResponse(version)); });
            historySrv = new HistorySrv();
            return historySrv.restoreDashboard(dash, version).then(function (response) {
                expect(response).toEqual(restoreResponse(version));
            });
        });
        it('should return an empty object when not given an id', function () { return __awaiter(void 0, void 0, void 0, function () {
            var rsp;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        historySrv = new HistorySrv();
                        return [4 /*yield*/, historySrv.restoreDashboard(emptyDash, 6)];
                    case 1:
                        rsp = _a.sent();
                        expect(rsp).toEqual({});
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=HistorySrv.test.js.map