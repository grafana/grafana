import {
  ADD_PIPELINE_VARIABLE,
  REMOVE_PIPELINE_VARIABLE,
  PipelineVariablesAction,
  RENAME_PIPELINE_VARIABLE,
  CHANGE_PIPELINE_VARIABLE_METRIC,
} from './types';

export const addPipelineVariable = (): PipelineVariablesAction => ({
  type: ADD_PIPELINE_VARIABLE,
});

export const removePipelineVariable = (index: number): PipelineVariablesAction => ({
  type: REMOVE_PIPELINE_VARIABLE,
  payload: {
    index,
  },
});

export const renamePipelineVariable = (newName: string, index: number): PipelineVariablesAction => ({
  type: RENAME_PIPELINE_VARIABLE,
  payload: {
    index,
    newName,
  },
});

export const changePipelineVariableMetric = (newMetric: string, index: number): PipelineVariablesAction => ({
  type: CHANGE_PIPELINE_VARIABLE_METRIC,
  payload: {
    index,
    newMetric,
  },
});
