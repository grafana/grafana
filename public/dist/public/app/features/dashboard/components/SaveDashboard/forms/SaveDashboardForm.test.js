import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { SaveDashboardForm } from './SaveDashboardForm';
var prepareDashboardMock = function (timeChanged, variableValuesChanged, resetTimeSpy, resetVarsSpy) {
    var json = {
        title: 'name',
        hasTimeChanged: jest.fn().mockReturnValue(timeChanged),
        hasVariableValuesChanged: jest.fn().mockReturnValue(variableValuesChanged),
        resetOriginalTime: function () { return resetTimeSpy(); },
        resetOriginalVariables: function () { return resetVarsSpy(); },
        getSaveModelClone: jest.fn().mockReturnValue({}),
    };
    return __assign(__assign({ id: 5, meta: {} }, json), { getSaveModelClone: function () { return json; } });
};
var renderAndSubmitForm = function (dashboard, submitSpy) { return __awaiter(void 0, void 0, void 0, function () {
    var container;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                container = mount(React.createElement(SaveDashboardForm, { dashboard: dashboard, onCancel: function () { }, onSuccess: function () { }, onSubmit: function (jsonModel) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            submitSpy(jsonModel);
                            return [2 /*return*/, { status: 'success' }];
                        });
                    }); } }));
                // @ts-ignore strict null error below
                return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                        var button;
                        return __generator(this, function (_a) {
                            button = container.find('button[aria-label="Dashboard settings Save Dashboard Modal Save button"]');
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
    describe('time and variables toggle rendering', function () {
        it('renders switches when variables or timerange', function () {
            var container = mount(React.createElement(SaveDashboardForm, { dashboard: prepareDashboardMock(true, true, jest.fn(), jest.fn()), onCancel: function () { }, onSuccess: function () { }, onSubmit: function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        return [2 /*return*/, {}];
                    });
                }); } }));
            var variablesCheckbox = container.find('input[aria-label="Dashboard settings Save Dashboard Modal Save variables checkbox"]');
            var timeRangeCheckbox = container.find('input[aria-label="Dashboard settings Save Dashboard Modal Save timerange checkbox"]');
            expect(variablesCheckbox).toHaveLength(1);
            expect(timeRangeCheckbox).toHaveLength(1);
        });
    });
    describe("when time and template vars haven't changed", function () {
        it("doesn't reset dashboard time and vars", function () { return __awaiter(void 0, void 0, void 0, function () {
            var resetTimeSpy, resetVarsSpy, submitSpy;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        resetTimeSpy = jest.fn();
                        resetVarsSpy = jest.fn();
                        submitSpy = jest.fn();
                        return [4 /*yield*/, renderAndSubmitForm(prepareDashboardMock(false, false, resetTimeSpy, resetVarsSpy), submitSpy)];
                    case 1:
                        _a.sent();
                        expect(resetTimeSpy).not.toBeCalled();
                        expect(resetVarsSpy).not.toBeCalled();
                        expect(submitSpy).toBeCalledTimes(1);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when time and template vars have changed', function () {
        describe("and user hasn't checked variable and time range save", function () {
            it('dont reset dashboard time and vars', function () { return __awaiter(void 0, void 0, void 0, function () {
                var resetTimeSpy, resetVarsSpy, submitSpy;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            resetTimeSpy = jest.fn();
                            resetVarsSpy = jest.fn();
                            submitSpy = jest.fn();
                            return [4 /*yield*/, renderAndSubmitForm(prepareDashboardMock(true, true, resetTimeSpy, resetVarsSpy), submitSpy)];
                        case 1:
                            _a.sent();
                            expect(resetTimeSpy).toBeCalledTimes(0);
                            expect(resetVarsSpy).toBeCalledTimes(0);
                            expect(submitSpy).toBeCalledTimes(1);
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
});
//# sourceMappingURL=SaveDashboardForm.test.js.map