import { DataSourceRef, QueryVariableModel } from '@grafana/data';

import { DatasourceVariableBuilder } from './datasourceVariableBuilder';

export class QueryVariableBuilder<T extends QueryVariableModel> extends DatasourceVariableBuilder<T> {
  withDatasource(datasource: DataSourceRef) {
    this.variable.datasource = datasource;
    return this;
  }
}
