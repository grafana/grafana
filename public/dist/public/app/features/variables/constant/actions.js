import { __awaiter } from "tslib";
import { validateVariableSelectionState } from '../state/actions';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { toVariablePayload } from '../utils';
import { createConstantOptionsFromQuery } from './reducer';
export const updateConstantVariableOptions = (identifier) => {
    return (dispatch) => __awaiter(void 0, void 0, void 0, function* () {
        const { rootStateKey } = identifier;
        yield dispatch(toKeyedAction(rootStateKey, createConstantOptionsFromQuery(toVariablePayload(identifier))));
        yield dispatch(validateVariableSelectionState(identifier));
    });
};
//# sourceMappingURL=actions.js.map