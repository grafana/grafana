import { defaultPipelineVariable, generatePipelineVariableName } from '../utils';
import { addPipelineVariable, changePipelineVariableMetric, removePipelineVariable, renamePipelineVariable, } from './actions';
export const reducer = (state = [], action) => {
    if (addPipelineVariable.match(action)) {
        return [...state, defaultPipelineVariable(generatePipelineVariableName(state))];
    }
    if (removePipelineVariable.match(action)) {
        return state.slice(0, action.payload).concat(state.slice(action.payload + 1));
    }
    if (renamePipelineVariable.match(action)) {
        return state.map((pipelineVariable, index) => {
            if (index !== action.payload.index) {
                return pipelineVariable;
            }
            return Object.assign(Object.assign({}, pipelineVariable), { name: action.payload.newName });
        });
    }
    if (changePipelineVariableMetric.match(action)) {
        return state.map((pipelineVariable, index) => {
            if (index !== action.payload.index) {
                return pipelineVariable;
            }
            return Object.assign(Object.assign({}, pipelineVariable), { pipelineAgg: action.payload.newMetric });
        });
    }
    return state;
};
//# sourceMappingURL=reducer.js.map