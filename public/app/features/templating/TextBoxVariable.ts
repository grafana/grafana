import { Variable, assignModelProperties, variableTypes } from './variable';
import { VariableSrv } from './variable_srv';

export class TextBoxVariable implements Variable {
  query: string;
  current: any;
  options: any[];
  skipUrlSync: boolean;

  defaults: any = {
    type: 'textbox',
    name: '',
    hide: 0,
    label: '',
    query: '',
    current: {},
    options: [],
    skipUrlSync: false,
  };

  /** @ngInject */
  constructor(private model: any, private variableSrv: VariableSrv) {
    assignModelProperties(this, model, this.defaults);
  }

  getSaveModel() {
    assignModelProperties(this.model, this, this.defaults);
    return this.model;
  }

  setValue(option: any) {
    this.variableSrv.setOptionAsCurrent(this, option);
  }

  updateOptions() {
    this.options = [{ text: this.query.trim(), value: this.query.trim() }];
    this.current = this.options[0];
    return Promise.resolve();
  }

  dependsOn(variable: any) {
    return false;
  }

  setValueFromUrl(urlValue: string) {
    this.query = urlValue;
    return this.variableSrv.setOptionFromUrl(this, urlValue);
  }

  getValueForUrl() {
    return this.current.value;
  }
}
// @ts-ignore
variableTypes['textbox'] = {
  name: 'Text box',
  ctor: TextBoxVariable,
  description: 'Define a textbox variable, where users can enter any arbitrary string',
};
