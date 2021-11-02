import { __assign, __read, __spreadArray } from "tslib";
import { defaultPipelineVariable, generatePipelineVariableName } from '../utils';
import { addPipelineVariable, changePipelineVariableMetric, removePipelineVariable, renamePipelineVariable, } from './actions';
export var reducer = function (state, action) {
    if (state === void 0) { state = []; }
    if (addPipelineVariable.match(action)) {
        return __spreadArray(__spreadArray([], __read(state), false), [defaultPipelineVariable(generatePipelineVariableName(state))], false);
    }
    if (removePipelineVariable.match(action)) {
        return state.slice(0, action.payload).concat(state.slice(action.payload + 1));
    }
    if (renamePipelineVariable.match(action)) {
        return state.map(function (pipelineVariable, index) {
            if (index !== action.payload.index) {
                return pipelineVariable;
            }
            return __assign(__assign({}, pipelineVariable), { name: action.payload.newName });
        });
    }
    if (changePipelineVariableMetric.match(action)) {
        return state.map(function (pipelineVariable, index) {
            if (index !== action.payload.index) {
                return pipelineVariable;
            }
            return __assign(__assign({}, pipelineVariable), { pipelineAgg: action.payload.newMetric });
        });
    }
    return state;
};
//# sourceMappingURL=reducer.js.map