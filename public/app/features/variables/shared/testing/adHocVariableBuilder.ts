import { DatasourceRef } from '@grafana/data';
import { AdHocVariableFilter, AdHocVariableModel } from 'app/features/variables/types';
import { VariableBuilder } from './variableBuilder';

export class AdHocVariableBuilder extends VariableBuilder<AdHocVariableModel> {
  withDatasource(datasource: DatasourceRef) {
    this.variable.datasource = datasource;
    return this;
  }

  withFilters(filters: AdHocVariableFilter[]) {
    this.variable.filters = filters;
    return this;
  }
}
