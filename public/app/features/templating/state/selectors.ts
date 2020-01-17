import { StoreState } from '../../../types';
import { VariableModel } from '../variable';

export const getVariables = (state: StoreState): VariableModel[] => {
  return [].concat(state.templating.query.variables);
};
