import { Action } from '@reduxjs/toolkit';

import { PipelineVariable } from 'app/plugins/datasource/elasticsearch/dataquery.gen';

import { defaultPipelineVariable, generatePipelineVariableName } from '../utils';

import {
  addPipelineVariable,
  changePipelineVariableMetric,
  removePipelineVariable,
  renamePipelineVariable,
} from './actions';

export const reducer = (state: PipelineVariable[] = [], action: Action) => {
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

      return {
        ...pipelineVariable,
        name: action.payload.newName,
      };
    });
  }

  if (changePipelineVariableMetric.match(action)) {
    return state.map((pipelineVariable, index) => {
      if (index !== action.payload.index) {
        return pipelineVariable;
      }

      return {
        ...pipelineVariable,
        pipelineAgg: action.payload.newMetric,
      };
    });
  }

  return state;
};
