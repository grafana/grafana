import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { mount } from 'enzyme';
import { SaveDashboardAsForm } from './SaveDashboardAsForm';
import { act } from 'react-dom/test-utils';
import * as api from 'app/features/manage-dashboards/state/actions';
jest.mock('app/features/plugins/datasource_srv', function () { return ({}); });
jest.mock('app/features/expressions/ExpressionDatasource', function () { return ({}); });
jest.mock('app/features/manage-dashboards/services/ValidationSrv', function () { return ({
    validateNewDashboardName: function () { return true; },
}); });
jest.spyOn(api, 'searchFolders').mockResolvedValue([]);
var prepareDashboardMock = function (panel) {
    var json = {
        title: 'name',
        panels: [panel],
    };
    return __assign(__assign({ id: 5, meta: {} }, json), { getSaveModelClone: function () { return json; } });
};
var renderAndSubmitForm = function (dashboard, submitSpy) { return __awaiter(void 0, void 0, void 0, function () {
    var container;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                container = mount(React.createElement(SaveDashboardAsForm, { dashboard: dashboard, onCancel: function () { }, onSuccess: function () { }, onSubmit: function (jsonModel) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            submitSpy(jsonModel);
                            return [2 /*return*/, {}];
                        });
                    }); } }));
                // @ts-ignore strict null error below
                return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                        var button;
                        return __generator(this, function (_a) {
                            button = container.find('button[aria-label="Save dashboard button"]');
                            button.simulate('submit');
                            return [2 /*return*/];
                        });
                    }); })];
            case 1:
                // @ts-ignore strict null error below
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
describe('SaveDashboardAsForm', function () {
    describe('default values', function () {
        it('applies default dashboard properties', function () { return __awaiter(void 0, void 0, void 0, function () {
            var spy, savedDashboardModel;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        jest.spyOn(api, 'searchFolders').mockResolvedValue([]);
                        spy = jest.fn();
                        return [4 /*yield*/, renderAndSubmitForm(prepareDashboardMock({}), spy)];
                    case 1:
                        _a.sent();
                        expect(spy).toBeCalledTimes(1);
                        savedDashboardModel = spy.mock.calls[0][0];
                        expect(savedDashboardModel.id).toBe(null);
                        expect(savedDashboardModel.title).toBe('name Copy');
                        expect(savedDashboardModel.editable).toBe(true);
                        expect(savedDashboardModel.hideControls).toBe(false);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('graph panel', function () {
        var panel = {
            id: 1,
            type: 'graph',
            alert: { rule: 1 },
            thresholds: { value: 3000 },
        };
        it('should remove alerts and thresholds from  panel', function () { return __awaiter(void 0, void 0, void 0, function () {
            var spy, savedDashboardModel;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        spy = jest.fn();
                        return [4 /*yield*/, renderAndSubmitForm(prepareDashboardMock(panel), spy)];
                    case 1:
                        _a.sent();
                        expect(spy).toBeCalledTimes(1);
                        savedDashboardModel = spy.mock.calls[0][0];
                        expect(savedDashboardModel.panels[0]).toEqual({ id: 1, type: 'graph' });
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('singestat panel', function () {
        var panel = { id: 1, type: 'singlestat', thresholds: { value: 3000 } };
        it('should keep thresholds', function () { return __awaiter(void 0, void 0, void 0, function () {
            var spy, savedDashboardModel;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        spy = jest.fn();
                        return [4 /*yield*/, renderAndSubmitForm(prepareDashboardMock(panel), spy)];
                    case 1:
                        _a.sent();
                        expect(spy).toBeCalledTimes(1);
                        savedDashboardModel = spy.mock.calls[0][0];
                        expect(savedDashboardModel.panels[0].thresholds).not.toBe(undefined);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('table panel', function () {
        var panel = { id: 1, type: 'table', thresholds: { value: 3000 } };
        it('should keep thresholds', function () { return __awaiter(void 0, void 0, void 0, function () {
            var spy, savedDashboardModel;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        spy = jest.fn();
                        return [4 /*yield*/, renderAndSubmitForm(prepareDashboardMock(panel), spy)];
                    case 1:
                        _a.sent();
                        expect(spy).toBeCalledTimes(1);
                        savedDashboardModel = spy.mock.calls[0][0];
                        expect(savedDashboardModel.panels[0].thresholds).not.toBe(undefined);
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=SaveDashboardAsForm.test.js.map