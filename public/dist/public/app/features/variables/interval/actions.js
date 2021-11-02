import { __awaiter, __generator } from "tslib";
import { rangeUtil } from '@grafana/data';
import { toVariablePayload } from '../state/types';
import { createIntervalOptions } from './reducer';
import { validateVariableSelectionState } from '../state/actions';
import { getVariable } from '../state/selectors';
import { getTimeSrv } from '../../dashboard/services/TimeSrv';
import { getTemplateSrv } from '../../templating/template_srv';
export var updateIntervalVariableOptions = function (identifier) { return function (dispatch) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, dispatch(createIntervalOptions(toVariablePayload(identifier)))];
            case 1:
                _a.sent();
                return [4 /*yield*/, dispatch(updateAutoValue(identifier))];
            case 2:
                _a.sent();
                return [4 /*yield*/, dispatch(validateVariableSelectionState(identifier))];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); }; };
export var updateAutoValue = function (identifier, dependencies) {
    if (dependencies === void 0) { dependencies = {
        calculateInterval: rangeUtil.calculateInterval,
        getTimeSrv: getTimeSrv,
        templateSrv: getTemplateSrv(),
    }; }
    return function (dispatch, getState) {
        var variableInState = getVariable(identifier.id, getState());
        if (variableInState.auto) {
            var res = dependencies.calculateInterval(dependencies.getTimeSrv().timeRange(), variableInState.auto_count, variableInState.auto_min);
            dependencies.templateSrv.setGrafanaVariable('$__auto_interval_' + variableInState.name, res.interval);
            // for backward compatibility, to be removed eventually
            dependencies.templateSrv.setGrafanaVariable('$__auto_interval', res.interval);
        }
    };
};
//# sourceMappingURL=actions.js.map