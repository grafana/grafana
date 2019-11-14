import { assignModelProperties, containsVariable, VariableActions, variableTypes } from './variable';
import { stringToJsRegex } from '@grafana/data';
import { VariableSrv } from './variable_srv';
import { TemplateSrv } from './template_srv';
import { DatasourceSrv } from '../plugins/datasource_srv';

export class DatasourceVariable implements VariableActions {
  regex: any;
  query: string;
  options: any;
  current: any;
  multi: boolean;
  includeAll: boolean;
  refresh: any;
  skipUrlSync: boolean;

  defaults: any = {
    type: 'datasource',
    name: '',
    hide: 0,
    label: '',
    current: {},
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
    const options = [];
    const sources = this.datasourceSrv.getMetricSources({ skipVariables: true });
    let regex;

    if (this.regex) {
      regex = this.templateSrv.replace(this.regex, null, 'regex');
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

      options.push({ text: source.name, value: source.name });
    }

    if (options.length === 0) {
      options.push({ text: 'No data sources found', value: '' });
    }

    this.options = options;
    if (this.includeAll) {
      this.addAllOption();
    }
    return this.variableSrv.validateVariableSelectionState(this);
  }

  addAllOption() {
    this.options.unshift({ text: 'All', value: '$__all' });
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
