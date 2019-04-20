import { Variable, assignModelProperties, variableTypes, containsVariable } from './variable';

export class MetaVariable implements Variable {
  query: string;
  current: any;
  options: any[];
  skipUrlSync: boolean;

  defaults = {
    type: 'meta',
    name: '',
    hide: 2,
    label: '',
    query: '',
    current: {},
    options: [],
    skipUrlSync: false,
  };

  /** @ngInject */
  constructor(private model, private variableSrv, private templateSrv) {
    assignModelProperties(this, model, this.defaults);
  }

  getSaveModel() {
    assignModelProperties(this.model, this, this.defaults);
    return this.model;
  }

  setValue(option) {
    this.variableSrv.setOptionAsCurrent(this, option);
  }

  updateOptions() {
    const text = this.query.trim();
    const value = this.templateSrv.replace(text, this.templateSrv.variables);
    this.options = [{ text: text, value: value }];
    this.current = this.options[0];
    return Promise.resolve();
  }

  dependsOn(variable) {
    return containsVariable(this.query, variable.name);
  }

  setValueFromUrl(urlValue) {
    this.query = urlValue;
    return this.variableSrv.setOptionFromUrl(this, urlValue);
  }

  getValueForUrl() {
    return this.current.text;
  }
}

variableTypes['meta'] = {
  name: 'Meta',
  ctor: MetaVariable,
  description: 'Define a hidden meta variable, where users can use other variables',
};
