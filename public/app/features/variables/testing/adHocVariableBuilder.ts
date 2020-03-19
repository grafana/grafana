import { AdHocVariableModel, VariableHide, AdHocVariableFilter } from 'app/features/templating/variable';
import { v4 } from 'uuid';

const initial: AdHocVariableModel = {
  uuid: v4(),
  global: false,
  type: 'adhoc',
  name: '',
  hide: VariableHide.dontHide,
  label: '',
  skipUrlSync: false,
  index: -1,
  initLock: null,
  datasource: null,
  filters: [],
};

export class AdHocVariableBuilder {
  private variable: AdHocVariableModel;

  constructor(partial: Partial<AdHocVariableModel>) {
    this.variable = {
      ...initial,
      ...partial,
    };
  }

  withName(name: string) {
    this.variable.name = name;
    return this;
  }

  withUUID(uuid: string) {
    this.variable.uuid = uuid;
    return this;
  }

  withDatasource(datasource: string) {
    this.variable.datasource = datasource;
    return this;
  }

  withFilters(filters: AdHocVariableFilter[]) {
    this.variable.filters = filters;
    return this;
  }

  build(): AdHocVariableModel {
    return this.variable;
  }
}
