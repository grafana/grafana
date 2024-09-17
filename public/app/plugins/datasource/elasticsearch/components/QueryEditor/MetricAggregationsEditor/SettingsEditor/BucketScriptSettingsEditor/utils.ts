import { PipelineVariable } from '../../../../../types';

export const defaultPipelineVariable = (name: string): PipelineVariable => ({ name, pipelineAgg: '' });

/**
 * Given an array of pipeline variables generates a new unique pipeline variable name in the form of `var{n}`.
 * The value for `n` is calculated based on the variables names in pipelineVars matching `var{n}`.
 */
export const generatePipelineVariableName = (pipelineVars: PipelineVariable[]): string =>
  `var${Math.max(0, ...pipelineVars.map((v) => parseInt(v.name.match('^var(\\d+)$')?.[1] || '0', 10))) + 1}`;
