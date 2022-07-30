import {
  AdHocVariableModel,
  BaseVariableModel,
  ConstantVariableModel,
  CustomVariableModel,
  DashboardVariableModel,
  DataSourceVariableModel,
  IntervalVariableModel,
  LoadingState,
  OrgVariableModel,
  QueryVariableModel,
  TextBoxVariableModel,
  UserVariableModel,
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

export function createQueryVariable(input: Partial<QueryVariableModel> = {}): QueryVariableModel {
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

export function createAdhocVariable(input?: Partial<AdHocVariableModel>): AdHocVariableModel {
  return {
    ...createBaseVariableModel(),
    type: 'adhoc',
    datasource: {
      uid: 'abc-123',
      type: 'prometheus',
    },
    filters: [],
    ...input,
  };
}

export function createConstantVariable(input: Partial<ConstantVariableModel> = {}): ConstantVariableModel {
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

export function createDatasourceVariable(input: Partial<DataSourceVariableModel> = {}): DataSourceVariableModel {
  return {
    ...createBaseVariableModel(),
    type: 'datasource',
    regex: '',
    refresh: VariableRefresh.onDashboardLoad,
    multi: false,
    includeAll: false,
    query: '',
    current: createVariableOption('prom-prod', 'Prometheus (main)', true),
    options: [createVariableOption('prom-prod', 'Prometheus (main)', true), createVariableOption('prom-dev')],
    ...input,
  };
}

export function createIntervalVariable(input: Partial<IntervalVariableModel> = {}): IntervalVariableModel {
  return {
    ...createBaseVariableModel(),
    type: 'interval',
    auto: false,
    auto_count: 30,
    auto_min: '10s',
    refresh: VariableRefresh.onTimeRangeChanged,
    query: '1m,10m,30m,1h,6h,12h,1d,7d,14d,30d',
    options: [],
    current: createVariableOption('10m'),
    ...input,
  };
}

export function createTextBoxVariable(input: Partial<TextBoxVariableModel> = {}): TextBoxVariableModel {
  return {
    ...createBaseVariableModel(),
    type: 'textbox',
    originalQuery: null,
    query: '',
    current: createVariableOption('prom-prod'),
    options: [],
    ...input,
  };
}

export function createUserVariable(input: Partial<UserVariableModel> = {}): UserVariableModel {
  return {
    ...createBaseVariableModel(),
    type: 'system',
    current: {
      value: {
        login: 'biggus-chungus',
        id: 0,
        email: 'chungus@example.com',
      },
    },
    ...input,
  };
}

export function createOrgVariable(input: Partial<OrgVariableModel> = {}): OrgVariableModel {
  return {
    ...createBaseVariableModel(),
    type: 'system',
    current: {
      value: {
        name: 'Big Chungus Corp.',
        id: 3,
      },
    },
    ...input,
  };
}

export function createDashboardVariable(input: Partial<DashboardVariableModel> = {}): DashboardVariableModel {
  return {
    ...createBaseVariableModel(),
    type: 'system',
    current: {
      value: {
        name: 'Chungus Monitoring',
        uid: 'b1g',
      },
    },
    ...input,
  };
}

export function createCustomVariable(input: Partial<CustomVariableModel> = {}): CustomVariableModel {
  return {
    ...createBaseVariableModel(),
    type: 'custom',
    multi: false,
    includeAll: false,
    current: createVariableOption('prom-prod', 'Prometheus (main)', true),
    options: [],
    query: '',
    ...input,
  };
}
