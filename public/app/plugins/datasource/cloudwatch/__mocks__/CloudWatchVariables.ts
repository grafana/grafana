import { BaseVariableModel, CustomVariableModel, LoadingState, VariableHide, VariableOption } from '@grafana/data';

export const initialVariableModelState: BaseVariableModel = {
  id: '00000000-0000-0000-0000-000000000000',
  rootStateKey: null,
  name: '',
  type: 'query',
  global: false,
  index: -1,
  hide: VariableHide.dontHide,
  skipUrlSync: false,
  state: LoadingState.NotStarted,
  error: null,
  description: null,
};

export const initialCustomVariableModelState: CustomVariableModel = {
  ...initialVariableModelState,
  type: 'custom',
  multi: false,
  includeAll: false,
  allValue: null,
  query: '',
  options: [],
  current: {} as VariableOption,
};
