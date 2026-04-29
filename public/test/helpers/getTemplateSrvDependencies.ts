import { type TemplateSrvDependencies } from 'app/features/templating/template_srv';

import { getFilteredVariables, getVariables, getVariableWithName } from '../../app/features/variables/state/selectors';
import { type StoreState } from '../../app/types/store';

export const getTemplateSrvDependencies = (state: StoreState): TemplateSrvDependencies => ({
  getFilteredVariables: (filter) => getFilteredVariables(filter, state),
  getVariableWithName: (name) => getVariableWithName(name, state),
  getVariables: () => getVariables(state),
});
