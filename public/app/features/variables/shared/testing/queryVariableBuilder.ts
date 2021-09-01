import { QueryVariableModel } from 'app/features/variables/types';
import { DatasourceVariableBuilder } from './datasourceVariableBuilder';

export class QueryVariableBuilder<T extends QueryVariableModel> extends DatasourceVariableBuilder<T> {
  withDatasource(datasource: string) {
    this.variable.datasource = datasource;
    return this;
  }
}
