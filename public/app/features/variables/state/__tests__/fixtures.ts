import {
  BaseVariableModel,
  ConstantVariableModel,
  CustomVariableModel,
  LoadingState,
  QueryVariableModel,
  VariableHide,
  VariableOption,
  VariableRefresh,
  VariableSort,
  VariableType,
} from '@grafana/data';

function createBaseVariableModel<T extends VariableType>(type: T): BaseVariableModel & { type: T } {
  return {
    name: 'myVariableName',
    id: '0',
    rootStateKey: 'key',
    global: false,
    hide: VariableHide.dontHide,
    skipUrlSync: false,
    index: 0,
    state: LoadingState.NotStarted,
    error: null,
    description: null,
    type,
  };
}

export function createVariableOption(value: string, rest: Partial<Omit<VariableOption, 'value'>> = {}): VariableOption {
  return {
    value,
    text: rest.text ?? value,
    selected: rest.selected ?? false,
  };
}

export function createQueryVariable(input: Partial<QueryVariableModel> = {}): QueryVariableModel {
  return {
    ...createBaseVariableModel('query'),
    label: 'DefaultLabel',
    datasource: {
      uid: 'abc-123',
      type: 'prometheus',
    },
    definition: 'def',
    sort: VariableSort.alphabeticalAsc,
    query: 'label_values(job)',
    regex: '',
    refresh: VariableRefresh.onDashboardLoad,
    multi: false,
    includeAll: false,
    current: createVariableOption('prom-prod', { text: 'Prometheus (main)', selected: true }),
    options: [
      createVariableOption('prom-prod', { text: 'Prometheus (main)', selected: true }),
      createVariableOption('prom-dev'),
    ],
    ...input,
  };
}

export function createConstantVariable(input: Partial<ConstantVariableModel>): ConstantVariableModel {
  return {
    ...createBaseVariableModel('constant'),
    query: '',
    current: createVariableOption('database'),
    options: [],
    hide: VariableHide.hideVariable,
    ...input,
  };
}

export function createCustomVariable(input: Partial<CustomVariableModel>): CustomVariableModel {
  return {
    ...createBaseVariableModel('custom'),
    multi: false,
    includeAll: false,
    current: createVariableOption('prom-prod', { text: 'Prometheus (main)', selected: true }),
    options: [],
    query: '',
    ...input,
  };
}
