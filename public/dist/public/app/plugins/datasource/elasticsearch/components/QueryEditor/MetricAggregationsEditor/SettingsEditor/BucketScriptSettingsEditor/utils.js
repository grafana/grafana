import { __read, __spreadArray } from "tslib";
export var defaultPipelineVariable = function (name) { return ({ name: name, pipelineAgg: '' }); };
/**
 * Given an array of pipeline variables generates a new unique pipeline variable name in the form of `var{n}`.
 * The value for `n` is calculated based on the variables names in pipelineVars matching `var{n}`.
 */
export var generatePipelineVariableName = function (pipelineVars) {
    return "var" + (Math.max.apply(Math, __spreadArray([0], __read(pipelineVars.map(function (v) { var _a; return parseInt(((_a = v.name.match('^var(\\d+)$')) === null || _a === void 0 ? void 0 : _a[1]) || '0', 10); })), false)) + 1);
};
//# sourceMappingURL=utils.js.map