import { createAction } from '@reduxjs/toolkit';
export const addPipelineVariable = createAction('@pipelineVariables/add');
export const removePipelineVariable = createAction('@pipelineVariables/remove');
export const renamePipelineVariable = createAction('@pipelineVariables/rename');
export const changePipelineVariableMetric = createAction('@pipelineVariables/change_metric');
//# sourceMappingURL=actions.js.map