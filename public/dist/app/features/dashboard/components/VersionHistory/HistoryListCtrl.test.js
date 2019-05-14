var _this = this;
import * as tslib_1 from "tslib";
import _ from 'lodash';
import { HistoryListCtrl } from './HistoryListCtrl';
import { versions, compare, restore } from './__mocks__/history';
import $q from 'q';
describe('HistoryListCtrl', function () {
    var RESTORE_ID = 4;
    var versionsResponse = versions();
    restore(7, RESTORE_ID);
    var historySrv;
    var $rootScope;
    var historyListCtrl;
    beforeEach(function () {
        historySrv = {
            calculateDiff: jest.fn(),
            restoreDashboard: jest.fn(function () { return $q.when({}); }),
        };
        $rootScope = {
            appEvent: jest.fn(),
            onAppEvent: jest.fn(),
        };
    });
    describe('when the history list component is loaded', function () {
        var deferred;
        beforeEach(function () {
            deferred = $q.defer({});
            historySrv.getHistoryList = jest.fn(function () { return deferred.promise; });
            historyListCtrl = new HistoryListCtrl({}, $rootScope, {}, $q, historySrv, {});
            historyListCtrl.dashboard = {
                id: 2,
                version: 3,
                formatDate: jest.fn(function () { return 'date'; }),
            };
        });
        it('should immediately attempt to fetch the history list', function () {
            expect(historySrv.getHistoryList).toHaveBeenCalledTimes(1);
        });
        describe('and the history list is successfully fetched', function () {
            beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            deferred.resolve(versionsResponse);
                            return [4 /*yield*/, historyListCtrl.getLog()];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it("should reset the controller's state", function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                return tslib_1.__generator(this, function (_a) {
                    expect(historyListCtrl.mode).toBe('list');
                    expect(historyListCtrl.delta).toEqual({ basic: '', json: '' });
                    expect(historyListCtrl.canCompare).toBe(false);
                    expect(_.find(historyListCtrl.revisions, function (rev) { return rev.checked; })).toBe(undefined);
                    return [2 /*return*/];
                });
            }); });
            it('should indicate loading has finished', function () {
                expect(historyListCtrl.loading).toBe(false);
            });
            it('should store the revisions sorted desc by version id', function () {
                expect(historyListCtrl.revisions[0].version).toBe(4);
                expect(historyListCtrl.revisions[1].version).toBe(3);
                expect(historyListCtrl.revisions[2].version).toBe(2);
                expect(historyListCtrl.revisions[3].version).toBe(1);
            });
            it('should add a checked property to each revision', function () {
                var actual = _.filter(historyListCtrl.revisions, function (rev) { return rev.hasOwnProperty('checked'); });
                expect(actual.length).toBe(4);
            });
            it('should set all checked properties to false on reset', function () {
                historyListCtrl.revisions[0].checked = true;
                historyListCtrl.revisions[2].checked = true;
                historyListCtrl.reset();
                var actual = _.filter(historyListCtrl.revisions, function (rev) { return !rev.checked; });
                expect(actual.length).toBe(4);
            });
        });
        describe('and fetching the history list fails', function () {
            beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            deferred = $q.defer();
                            historySrv.getHistoryList = jest.fn(function () { return deferred.promise; });
                            historyListCtrl = new HistoryListCtrl({}, $rootScope, {}, $q, historySrv, {});
                            deferred.reject(new Error('HistoryListError'));
                            return [4 /*yield*/, historyListCtrl.getLog()];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it("should reset the controller's state", function () {
                expect(historyListCtrl.mode).toBe('list');
                expect(historyListCtrl.delta).toEqual({ basic: '', json: '' });
                expect(_.find(historyListCtrl.revisions, function (rev) { return rev.checked; })).toBe(undefined);
            });
            it('should indicate loading has finished', function () {
                expect(historyListCtrl.loading).toBe(false);
            });
            it('should have an empty revisions list', function () {
                expect(historyListCtrl.revisions).toEqual([]);
            });
        });
        describe('should update the history list when the dashboard is saved', function () {
            beforeEach(function () {
                historyListCtrl.dashboard = { version: 3 };
                historyListCtrl.resetFromSource = jest.fn();
            });
            it('should listen for the `dashboard-saved` appEvent', function () {
                expect($rootScope.onAppEvent).toHaveBeenCalledTimes(1);
                expect($rootScope.onAppEvent.mock.calls[0][0]).toBe('dashboard-saved');
            });
            it('should call `onDashboardSaved` when the appEvent is received', function () {
                expect($rootScope.onAppEvent.mock.calls[0][1]).not.toBe(historyListCtrl.onDashboardSaved);
                expect($rootScope.onAppEvent.mock.calls[0][1].toString).toBe(historyListCtrl.onDashboardSaved.toString);
            });
        });
    });
    describe('when the user wants to compare two revisions', function () {
        var deferred;
        beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        deferred = $q.defer({});
                        historySrv.getHistoryList = jest.fn(function () { return $q.when(versionsResponse); });
                        historySrv.calculateDiff = jest.fn(function () { return deferred.promise; });
                        historyListCtrl = new HistoryListCtrl({}, $rootScope, {}, $q, historySrv, {});
                        historyListCtrl.dashboard = {
                            id: 2,
                            version: 3,
                            formatDate: jest.fn(function () { return 'date'; }),
                        };
                        deferred.resolve(versionsResponse);
                        return [4 /*yield*/, historyListCtrl.getLog()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should have already fetched the history list', function () {
            expect(historySrv.getHistoryList).toHaveBeenCalled();
            expect(historyListCtrl.revisions.length).toBeGreaterThan(0);
        });
        it('should check that two valid versions are selected', function () {
            // []
            expect(historyListCtrl.canCompare).toBe(false);
            // single value
            historyListCtrl.revisions = [{ checked: true }];
            historyListCtrl.revisionSelectionChanged();
            expect(historyListCtrl.canCompare).toBe(false);
            // both values in range
            historyListCtrl.revisions = [{ checked: true }, { checked: true }];
            historyListCtrl.revisionSelectionChanged();
            expect(historyListCtrl.canCompare).toBe(true);
        });
        describe('and the basic diff is successfully fetched', function () {
            beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            deferred = $q.defer({});
                            historySrv.calculateDiff = jest.fn(function () { return deferred.promise; });
                            deferred.resolve(compare('basic'));
                            historyListCtrl.revisions[1].checked = true;
                            historyListCtrl.revisions[3].checked = true;
                            return [4 /*yield*/, historyListCtrl.getDiff('basic')];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should fetch the basic diff if two valid versions are selected', function () {
                expect(historySrv.calculateDiff).toHaveBeenCalledTimes(1);
                expect(historyListCtrl.delta.basic).toBe('<div></div>');
                expect(historyListCtrl.delta.json).toBe('');
            });
            it('should set the basic diff view as active', function () {
                expect(historyListCtrl.mode).toBe('compare');
                expect(historyListCtrl.diff).toBe('basic');
            });
            it('should indicate loading has finished', function () {
                expect(historyListCtrl.loading).toBe(false);
            });
        });
        describe('and the json diff is successfully fetched', function () {
            beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            deferred = $q.defer({});
                            historySrv.calculateDiff = jest.fn(function () { return deferred.promise; });
                            deferred.resolve(compare('json'));
                            historyListCtrl.revisions[1].checked = true;
                            historyListCtrl.revisions[3].checked = true;
                            return [4 /*yield*/, historyListCtrl.getDiff('json')];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should fetch the json diff if two valid versions are selected', function () {
                expect(historySrv.calculateDiff).toHaveBeenCalledTimes(1);
                expect(historyListCtrl.delta.basic).toBe('');
                expect(historyListCtrl.delta.json).toBe('<pre><code></code></pre>');
            });
            it('should set the json diff view as active', function () {
                expect(historyListCtrl.mode).toBe('compare');
                expect(historyListCtrl.diff).toBe('json');
            });
            it('should indicate loading has finished', function () {
                expect(historyListCtrl.loading).toBe(false);
            });
        });
        describe('and diffs have already been fetched', function () {
            beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            deferred.resolve(compare('basic'));
                            historyListCtrl.revisions[3].checked = true;
                            historyListCtrl.revisions[1].checked = true;
                            historyListCtrl.delta.basic = 'cached basic';
                            historyListCtrl.getDiff('basic');
                            return [4 /*yield*/, historySrv.calculateDiff()];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should use the cached diffs instead of fetching', function () {
                expect(historySrv.calculateDiff).toHaveBeenCalledTimes(1);
                expect(historyListCtrl.delta.basic).toBe('cached basic');
            });
            it('should indicate loading has finished', function () {
                expect(historyListCtrl.loading).toBe(false);
            });
        });
        describe('and fetching the diff fails', function () {
            beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            deferred = $q.defer({});
                            historySrv.calculateDiff = jest.fn(function () { return deferred.promise; });
                            historyListCtrl.revisions[3].checked = true;
                            historyListCtrl.revisions[1].checked = true;
                            deferred.reject();
                            return [4 /*yield*/, historyListCtrl.getDiff('basic')];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should fetch the diff if two valid versions are selected', function () {
                expect(historySrv.calculateDiff).toHaveBeenCalledTimes(1);
            });
            it('should return to the history list view', function () {
                expect(historyListCtrl.mode).toBe('list');
            });
            it('should indicate loading has finished', function () {
                expect(historyListCtrl.loading).toBe(false);
            });
            it('should have an empty delta/changeset', function () {
                expect(historyListCtrl.delta).toEqual({ basic: '', json: '' });
            });
        });
    });
    describe('when the user wants to restore a revision', function () {
        var deferred;
        beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        deferred = $q.defer();
                        historySrv.getHistoryList = jest.fn(function () { return $q.when(versionsResponse); });
                        historySrv.restoreDashboard = jest.fn(function () { return deferred.promise; });
                        historyListCtrl = new HistoryListCtrl({}, $rootScope, {}, $q, historySrv, {});
                        historyListCtrl.dashboard = {
                            id: 1,
                        };
                        historyListCtrl.restore();
                        deferred.resolve(versionsResponse);
                        return [4 /*yield*/, historyListCtrl.getLog()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        it('should display a modal allowing the user to restore or cancel', function () {
            expect($rootScope.appEvent).toHaveBeenCalledTimes(1);
            expect($rootScope.appEvent.mock.calls[0][0]).toBe('confirm-modal');
        });
        describe('and restore fails to fetch', function () {
            beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            deferred = $q.defer();
                            historySrv.getHistoryList = jest.fn(function () { return $q.when(versionsResponse); });
                            historySrv.restoreDashboard = jest.fn(function () { return deferred.promise; });
                            historyListCtrl = new HistoryListCtrl({}, $rootScope, {}, $q, historySrv, {});
                            deferred.reject(new Error('RestoreError'));
                            historyListCtrl.restoreConfirm(RESTORE_ID);
                            return [4 /*yield*/, historyListCtrl.getLog()];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should indicate loading has finished', function () {
                expect(historyListCtrl.loading).toBe(false);
            });
        });
    });
});
//# sourceMappingURL=HistoryListCtrl.test.js.map