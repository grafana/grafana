import { createAction } from '@reduxjs/toolkit';

export const addPipelineVariable = createAction('@pipelineVariables/add');
export const removePipelineVariable = createAction<number>('@pipelineVariables/remove');

export const renamePipelineVariable = createAction<{ index: number; newName: string }>('@pipelineVariables/rename');

export const changePipelineVariableMetric = createAction<{ index: number; newMetric: string }>(
  '@pipelineVariables/change_metric'
);
