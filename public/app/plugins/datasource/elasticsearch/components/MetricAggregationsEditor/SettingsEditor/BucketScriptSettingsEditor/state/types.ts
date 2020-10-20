import { Action } from '../../../../../hooks/useReducerCallback';

export const ADD_PIPELINE_VARIABLE = '@pipelineVariables/add';
export const REMOVE_PIPELINE_VARIABLE = '@pipelineVariables/remove';
export const RENAME_PIPELINE_VARIABLE = '@pipelineVariables/rename';
export const CHANGE_PIPELINE_VARIABLE_METRIC = '@pipelineVariables/change_metric';

export type AddPipelineVariableAction = Action<typeof ADD_PIPELINE_VARIABLE>;

export interface RemovePipelineVariableAction extends Action<typeof REMOVE_PIPELINE_VARIABLE> {
  payload: {
    index: number;
  };
}

export interface RenamePipelineVariableAction extends Action<typeof RENAME_PIPELINE_VARIABLE> {
  payload: {
    index: number;
    newName: string;
  };
}

export interface ChangePipelineVariableMetricAction extends Action<typeof CHANGE_PIPELINE_VARIABLE_METRIC> {
  payload: {
    index: number;
    newMetric: string;
  };
}

export type PipelineVariablesAction =
  | AddPipelineVariableAction
  | RemovePipelineVariableAction
  | RenamePipelineVariableAction
  | ChangePipelineVariableMetricAction;
