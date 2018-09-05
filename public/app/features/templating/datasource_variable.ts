import kbn from 'app/core/utils/kbn';
import { Variable, containsVariable, assignModelProperties, variableTypes } from './variable';

export class DatasourceVariable implements Variable {
  regex: any;
  query: string;
  options: any;
  current: any;
  refresh: any;
  skipUrlSync: boolean;

  defaults = {
    type: 'datasource',
    name: '',
    hide: 0,
    label: '',
    current: {},
    regex: '',
    options: [],
    query: '',
    refresh: 1,
    skipUrlSync: false,
  };

  /** @ngInject */
  constructor(private model, private datasourceSrv, private variableSrv, private templateSrv) {
    assignModelProperties(this, model, this.defaults);
    this.refresh = 1;
  }

  getSaveModel() {
    assignModelProperties(this.model, this, this.defaults);

    // don't persist options
    this.model.options = [];
    return this.model;
  }

  setValue(option) {
    return this.variableSrv.setOptionAsCurrent(this, option);
  }

  updateOptions() {
    const options = [];
    const sources = this.datasourceSrv.getMetricSources({ skipVariables: true });
    let regex;

    if (this.regex) {
      regex = this.templateSrv.replace(this.regex, null, 'regex');
      regex = kbn.stringToJsRegex(regex);
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
    return this.variableSrv.validateVariableSelectionState(this);
  }

  dependsOn(variable) {
    if (this.regex) {
      return containsVariable(this.regex, variable.name);
    }
    return false;
  }

  setValueFromUrl(urlValue) {
    return this.variableSrv.setOptionFromUrl(this, urlValue);
  }

  getValueForUrl() {
    return this.current.value;
  }
}

variableTypes['datasource'] = {
  name: 'Datasource',
  ctor: DatasourceVariable,
  description: 'Enabled you to dynamically switch the datasource for multiple panels',
};
