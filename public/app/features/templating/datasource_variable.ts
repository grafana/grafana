import {
  assignModelProperties,
  DataSourceVariableModel,
  VariableActions,
  VariableHide,
  VariableOption,
  VariableRefresh,
  variableTypes,
} from './types';
import { VariableType, stringToJsRegex } from '@grafana/data';
import { VariableSrv } from './variable_srv';
import { TemplateSrv } from './template_srv';
import { DatasourceSrv } from '../plugins/datasource_srv';
import { config } from '@grafana/runtime';
import { containsVariable } from './utils';

export class DatasourceVariable implements DataSourceVariableModel, VariableActions {
  type: VariableType;
  name: string;
  label: string;
  hide: VariableHide;
  regex: any;
  query: string;
  options: VariableOption[];
  current: VariableOption;
  multi: boolean;
  includeAll: boolean;
  refresh: VariableRefresh;
  skipUrlSync: boolean;

  defaults: DataSourceVariableModel = {
    type: 'datasource',
    name: '',
    hide: 0,
    label: '',
    current: {} as VariableOption,
    regex: '',
    options: [],
    query: '',
    multi: false,
    includeAll: false,
    refresh: 1,
    skipUrlSync: false,
  };

  /** @ngInject */
  constructor(
    private model: any,
    private datasourceSrv: DatasourceSrv,
    private variableSrv: VariableSrv,
    private templateSrv: TemplateSrv
  ) {
    assignModelProperties(this, model, this.defaults);
    this.refresh = 1;
  }

  getSaveModel() {
    assignModelProperties(this.model, this, this.defaults);

    // don't persist options
    this.model.options = [];
    return this.model;
  }

  setValue(option: any) {
    return this.variableSrv.setOptionAsCurrent(this, option);
  }

  updateOptions() {
    const options: VariableOption[] = [];
    const sources = this.datasourceSrv.getMetricSources({ skipVariables: true });
    let regex;

    if (this.regex) {
      regex = this.templateSrv.replace(this.regex, undefined, 'regex');
      regex = stringToJsRegex(regex);
    }

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      // must match on type
      if (source.meta.id !== this.query) {
        continue;
      }

      if (regex && !regex.exec(source.name)) {
        continue;
      }

      options.push({ text: source.name, value: source.name, selected: false });
    }

    if (options.length === 0) {
      options.push({ text: 'No data sources found', value: '', selected: false });
    }

    this.options = options;
    if (this.includeAll) {
      this.addAllOption();
    }
    const { defaultDatasource } = config.bootData.settings;
    return this.variableSrv.validateVariableSelectionState(this, defaultDatasource);
  }

  addAllOption() {
    this.options.unshift({ text: 'All', value: '$__all', selected: false });
  }

  dependsOn(variable: any) {
    if (this.regex) {
      return containsVariable(this.regex, variable.name);
    }
    return false;
  }

  setValueFromUrl(urlValue: string | string[]) {
    return this.variableSrv.setOptionFromUrl(this, urlValue);
  }

  getValueForUrl() {
    if (this.current.text === 'All') {
      return 'All';
    }
    return this.current.value;
  }
}

variableTypes['datasource'] = {
  name: 'Datasource',
  ctor: DatasourceVariable,
  supportsMulti: true,
  description: 'Enabled you to dynamically switch the datasource for multiple panels',
};
