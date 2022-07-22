import { DataSourceVariableModel, VariableRefresh } from 'app/features/variables/types';

import { MultiVariableBuilder } from './multiVariableBuilder';

export class DatasourceVariableBuilder<T extends DataSourceVariableModel> extends MultiVariableBuilder<T> {
  withRefresh(refresh: VariableRefresh) {
    this.variable.refresh = refresh;
    return this;
  }

  withRegEx(regex: any) {
    this.variable.regex = regex;
    return this;
  }
}
