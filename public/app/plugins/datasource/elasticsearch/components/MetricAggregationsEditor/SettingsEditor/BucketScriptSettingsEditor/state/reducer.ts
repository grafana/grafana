import { PipelineVariable } from '../../../state/types';
import { defaultPipelineVariable } from '../utils';
import {
  PipelineVariablesAction,
  REMOVE_PIPELINE_VARIABLE,
  ADD_PIPELINE_VARIABLE,
  RENAME_PIPELINE_VARIABLE,
  CHANGE_PIPELINE_VARIABLE_METRIC,
} from './types';

export default (state: PipelineVariable[], action: PipelineVariablesAction) => {
  switch (action.type) {
    case ADD_PIPELINE_VARIABLE:
      return [...state, defaultPipelineVariable()];

    case REMOVE_PIPELINE_VARIABLE:
      return state.slice(0, action.payload.index).concat(state.slice(action.payload.index + 1));

    case RENAME_PIPELINE_VARIABLE:
      return state.map((pipelineVariable, index) => {
        if (index !== action.payload.index) {
          return pipelineVariable;
        }

        return {
          ...pipelineVariable,
          name: action.payload.newName,
        };
      });

    case CHANGE_PIPELINE_VARIABLE_METRIC:
      return state.map((pipelineVariable, index) => {
        if (index !== action.payload.index) {
          return pipelineVariable;
        }

        return {
          ...pipelineVariable,
          pipelineAgg: action.payload.newMetric,
        };
      });

    default:
      return state;
  }
};
