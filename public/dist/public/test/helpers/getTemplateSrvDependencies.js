import { getFilteredVariables, getVariables, getVariableWithName } from '../../app/features/variables/state/selectors';
export var getTemplateSrvDependencies = function (state) { return ({
    getFilteredVariables: function (filter) { return getFilteredVariables(filter, state); },
    getVariableWithName: function (name) { return getVariableWithName(name, state); },
    getVariables: function () { return getVariables(state); },
}); };
//# sourceMappingURL=getTemplateSrvDependencies.js.map