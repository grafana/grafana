import { cloneDeep } from 'lodash';

import { LoadingState, QueryVariableModel, VariableHide, VariableRefresh, VariableSort } from '@grafana/data';

const initialState: QueryVariableModel = {
  id: '00000000-0000-0000-0000-000000000000',
  rootStateKey: null,
  name: 'query',
  type: 'query',
  global: false,
  index: -1,
  hide: VariableHide.dontHide,
  skipUrlSync: false,
  state: LoadingState.NotStarted,
  error: null,
  description: null,
  datasource: null,
  query: '',
  regex: '',
  sort: VariableSort.disabled,
  refresh: VariableRefresh.onDashboardLoad,
  multi: false,
  includeAll: false,
  allValue: null,
  options: [],
  current: {},
  definition: '',
};

class QueryVariableBuilder {
  private variable: QueryVariableModel;

  constructor() {
    const { id, index, global, ...rest } = initialState;
    this.variable = cloneDeep({ ...rest, name: rest.type }) as QueryVariableModel;
  }

  withId(id: string) {
    this.variable.id = id;
    return this;
  }

  withName(name: string) {
    this.variable.name = name;
    return this;
  }

  withMulti(multi = true) {
    this.variable.multi = multi;
    return this;
  }

  withIncludeAll(includeAll = true) {
    this.variable.includeAll = includeAll;
    return this;
  }

  withAllValue(allValue: string) {
    this.variable.allValue = allValue;
    return this;
  }

  withCurrent(text: string | string[], value?: string | string[]) {
    this.variable.current = {
      text,
      value: value ?? text,
      selected: true,
    };
    return this;
  }

  withOptions(...options: Array<string | { text: string; value: string }>) {
    this.variable.options = [];
    for (const option of options) {
      if (typeof option === 'string') {
        this.variable.options.push({ text: option, value: option, selected: false });
      } else {
        this.variable.options.push({ ...option, selected: false });
      }
    }
    return this;
  }

  build(): QueryVariableModel {
    return this.variable;
  }
}

export const queryBuilder = () => new QueryVariableBuilder();
