var _this = this;
import * as tslib_1 from "tslib";
import { versions, restore } from './__mocks__/history';
import { HistorySrv } from './HistorySrv';
import { DashboardModel } from '../../state/DashboardModel';
jest.mock('app/core/store');
describe('historySrv', function () {
    var versionsResponse = versions();
    var restoreResponse = restore;
    var backendSrv = {
        get: jest.fn(function () { return Promise.resolve({}); }),
        post: jest.fn(function () { return Promise.resolve({}); }),
    };
    var historySrv = new HistorySrv(backendSrv);
    var dash = new DashboardModel({ id: 1 });
    var emptyDash = new DashboardModel({});
    var historyListOpts = { limit: 10, start: 0 };
    describe('getHistoryList', function () {
        it('should return a versions array for the given dashboard id', function () {
            backendSrv.get = jest.fn(function () { return Promise.resolve(versionsResponse); });
            historySrv = new HistorySrv(backendSrv);
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
            backendSrv.post = jest.fn(function () { return Promise.resolve(restoreResponse(version)); });
            historySrv = new HistorySrv(backendSrv);
            return historySrv.restoreDashboard(dash, version).then(function (response) {
                expect(response).toEqual(restoreResponse(version));
            });
        });
        it('should return an empty object when not given an id', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var rsp;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        historySrv = new HistorySrv(backendSrv);
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