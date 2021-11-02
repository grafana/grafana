import { __awaiter, __generator } from "tslib";
import { validateVariableSelectionState } from '../state/actions';
import { createCustomOptionsFromQuery } from './reducer';
import { toVariablePayload } from '../state/types';
export var updateCustomVariableOptions = function (identifier) {
    return function (dispatch) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, dispatch(createCustomOptionsFromQuery(toVariablePayload(identifier)))];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, dispatch(validateVariableSelectionState(identifier))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
};
//# sourceMappingURL=actions.js.map