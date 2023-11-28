export const defaultPipelineVariable = (name) => ({ name, pipelineAgg: '' });
/**
 * Given an array of pipeline variables generates a new unique pipeline variable name in the form of `var{n}`.
 * The value for `n` is calculated based on the variables names in pipelineVars matching `var{n}`.
 */
export const generatePipelineVariableName = (pipelineVars) => `var${Math.max(0, ...pipelineVars.map((v) => { var _a; return parseInt(((_a = v.name.match('^var(\\d+)$')) === null || _a === void 0 ? void 0 : _a[1]) || '0', 10); })) + 1}`;
//# sourceMappingURL=utils.js.map