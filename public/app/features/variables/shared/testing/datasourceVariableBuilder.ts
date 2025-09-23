import { DataSourceVariableModel, QueryVariableModel, VariableRefresh } from '@grafana/data';

import { MultiVariableBuilder } from './multiVariableBuilder';

export class DatasourceVariableBuilder<
  T extends DataSourceVariableModel | QueryVariableModel,
> extends MultiVariableBuilder<T> {
  withRefresh(refresh: VariableRefresh) {
    this.variable.refresh = refresh;
    return this;
  }

  withRegEx(regex: string) {
    this.variable.regex = regex;
    return this;
  }
}
