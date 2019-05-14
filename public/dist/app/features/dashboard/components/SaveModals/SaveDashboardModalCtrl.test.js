var _this = this;
import * as tslib_1 from "tslib";
import { SaveDashboardModalCtrl } from './SaveDashboardModalCtrl';
var setup = function (timeChanged, variableValuesChanged, cb) {
    var dash = {
        hasTimeChanged: jest.fn().mockReturnValue(timeChanged),
        hasVariableValuesChanged: jest.fn().mockReturnValue(variableValuesChanged),
        resetOriginalTime: jest.fn(),
        resetOriginalVariables: jest.fn(),
        getSaveModelClone: jest.fn().mockReturnValue({}),
    };
    var dashboardSrvMock = {
        getCurrent: jest.fn().mockReturnValue(dash),
        save: jest.fn().mockReturnValue(Promise.resolve()),
    };
    var ctrl = new SaveDashboardModalCtrl(dashboardSrvMock);
    ctrl.saveForm = {
        $valid: true,
    };
    ctrl.dismiss = function () { return Promise.resolve(); };
    cb(dash, ctrl, dashboardSrvMock);
};
describe('SaveDashboardModal', function () {
    describe('Given time and template variable values have not changed', function () {
        setup(false, false, function (dash, ctrl) {
            it('When creating ctrl should set time and template variable values changed', function () {
                expect(ctrl.timeChange).toBeFalsy();
                expect(ctrl.variableValueChange).toBeFalsy();
            });
        });
    });
    describe('Given time and template variable values have changed', function () {
        setup(true, true, function (dash, ctrl) {
            it('When creating ctrl should set time and template variable values changed', function () {
                expect(ctrl.timeChange).toBeTruthy();
                expect(ctrl.variableValueChange).toBeTruthy();
            });
            it('When save time and variable value changes disabled and saving should reset original time and template variable values', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ctrl.saveTimerange = false;
                            ctrl.saveVariables = false;
                            return [4 /*yield*/, ctrl.save()];
                        case 1:
                            _a.sent();
                            expect(dash.resetOriginalTime).toHaveBeenCalledTimes(0);
                            expect(dash.resetOriginalVariables).toHaveBeenCalledTimes(0);
                            return [2 /*return*/];
                    }
                });
            }); });
            it('When save time and variable value changes enabled and saving should reset original time and template variable values', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            ctrl.saveTimerange = true;
                            ctrl.saveVariables = true;
                            return [4 /*yield*/, ctrl.save()];
                        case 1:
                            _a.sent();
                            expect(dash.resetOriginalTime).toHaveBeenCalledTimes(1);
                            expect(dash.resetOriginalVariables).toHaveBeenCalledTimes(1);
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
});
//# sourceMappingURL=SaveDashboardModalCtrl.test.js.map