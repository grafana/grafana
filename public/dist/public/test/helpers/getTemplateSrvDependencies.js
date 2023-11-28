import { getFilteredVariables, getVariables, getVariableWithName } from '../../app/features/variables/state/selectors';
export const getTemplateSrvDependencies = (state) => ({
    getFilteredVariables: (filter) => getFilteredVariables(filter, state),
    getVariableWithName: (name) => getVariableWithName(name, state),
    getVariables: () => getVariables(state),
});
//# sourceMappingURL=getTemplateSrvDependencies.js.map