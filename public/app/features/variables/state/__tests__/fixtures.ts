import {
  BaseVariableModel,
  ConstantVariableModel,
  LoadingState,
  QueryVariableModel,
  VariableHide,
  VariableOption,
  VariableRefresh,
  VariableSort,
} from '@grafana/data';

export function createBaseVariableModel(): Omit<BaseVariableModel, 'type'> {
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
  };
}

export function createVariableOption(value: string, text?: string, selected = false): VariableOption {
  return {
    value,
    text: text ?? value,
    selected,
  };
}

export function createQueryVariable(input: Partial<QueryVariableModel>): QueryVariableModel {
  return {
    ...createBaseVariableModel(),
    type: 'query',
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
    current: createVariableOption('prom-prod', 'Prometheus (main)', true),
    options: [createVariableOption('prom-prod', 'Prometheus (main)', true), createVariableOption('prom-dev')],
    ...input,
  };
}

export function createConstantVariable(input: Partial<ConstantVariableModel>): ConstantVariableModel {
  return {
    ...createBaseVariableModel(),
    type: 'constant',
    query: '',
    current: createVariableOption('database'),
    options: [],
    hide: VariableHide.hideVariable,
    ...input,
  };
}
