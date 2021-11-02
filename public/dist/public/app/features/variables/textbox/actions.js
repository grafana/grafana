import { __awaiter, __generator } from "tslib";
import { getVariable } from '../state/selectors';
import { variableAdapters } from '../adapters';
import { createTextBoxOptions } from './reducer';
import { toVariableIdentifier, toVariablePayload } from '../state/types';
import { setOptionFromUrl } from '../state/actions';
import { changeVariableProp } from '../state/sharedReducer';
import { ensureStringValues } from '../utils';
export var updateTextBoxVariableOptions = function (identifier) {
    return function (dispatch, getState) { return __awaiter(void 0, void 0, void 0, function () {
        var variableInState;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, dispatch(createTextBoxOptions(toVariablePayload(identifier)))];
                case 1:
                    _a.sent();
                    variableInState = getVariable(identifier.id, getState());
                    return [4 /*yield*/, variableAdapters.get(identifier.type).setValue(variableInState, variableInState.options[0], true)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
};
export var setTextBoxVariableOptionsFromUrl = function (identifier, urlValue) { return function (dispatch, getState) { return __awaiter(void 0, void 0, void 0, function () {
    var variableInState, stringUrlValue;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                variableInState = getVariable(identifier.id, getState());
                stringUrlValue = ensureStringValues(urlValue);
                dispatch(changeVariableProp(toVariablePayload(variableInState, { propName: 'query', propValue: stringUrlValue })));
                return [4 /*yield*/, dispatch(setOptionFromUrl(toVariableIdentifier(variableInState), stringUrlValue))];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); }; };
//# sourceMappingURL=actions.js.map