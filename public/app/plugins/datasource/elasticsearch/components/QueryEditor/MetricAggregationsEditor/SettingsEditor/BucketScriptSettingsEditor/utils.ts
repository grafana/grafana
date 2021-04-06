import { PipelineVariable } from '../../aggregations';

export const defaultPipelineVariable = (name = 'var1'): PipelineVariable => ({ name, pipelineAgg: '' });
