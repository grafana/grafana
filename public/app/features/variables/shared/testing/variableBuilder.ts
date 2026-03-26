import { cloneDeep } from 'lodash';

import { BaseVariableModel } from '@grafana/data';

export class VariableBuilder<T extends BaseVariableModel> {
  protected variable: T;

  constructor(initialState: T) {
    const { id, index, global, ...rest } = initialState;
    this.variable = cloneDeep({ ...rest, name: rest.type }) as T;
  }

  withName(name: string) {
    this.variable.name = name;
    return this;
  }

  withId(id: string) {
    this.variable.id = id;
    return this;
  }

  withRootStateKey(key: string) {
    this.variable.rootStateKey = key;
    return this;
  }

  build(): T {
    return this.variable;
  }
}
