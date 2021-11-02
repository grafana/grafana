import { createAction } from '@reduxjs/toolkit';
export var addPipelineVariable = createAction('@pipelineVariables/add');
export var removePipelineVariable = createAction('@pipelineVariables/remove');
export var renamePipelineVariable = createAction('@pipelineVariables/rename');
export var changePipelineVariableMetric = createAction('@pipelineVariables/change_metric');
//# sourceMappingURL=actions.js.map