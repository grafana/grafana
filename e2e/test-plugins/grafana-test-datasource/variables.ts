import { VariableSupportBase, VariableSupportType } from '@grafana/data';
import { DEFAULT_QUERY, MyQuery } from './types';
import { DataSource } from './datasource';

export class VariableSupport extends VariableSupportBase<DataSource> {
  getType(): VariableSupportType {
    return VariableSupportType.Datasource;
  }

  getDefaultQuery(): Partial<MyQuery> {
    return DEFAULT_QUERY;
  }
}
