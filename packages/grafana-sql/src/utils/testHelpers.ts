import { CustomVariableModel, LoadingState, VariableHide } from '@grafana/data';

export function makeVariable(id: string, name: string, attributes?: Partial<CustomVariableModel>): CustomVariableModel {
  return {
    multi: false,
    type: 'custom',
    includeAll: false,
    current: {},
    options: [],
    query: '',
    rootStateKey: null,
    global: false,
    hide: VariableHide.dontHide,
    skipUrlSync: false,
    index: -1,
    state: LoadingState.NotStarted,
    error: null,
    description: null,
    ...attributes,
    id,
    name,
  };
}
