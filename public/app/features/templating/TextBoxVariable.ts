import { Variable, VariableBase, assignModelProperties, variableTypes } from './variable';

export class TextBoxVariable extends VariableBase implements Variable {
  query: string;
  options: any[];
  skipUrlSync: boolean;

  defaults = {
    type: 'textbox',
    name: '',
    hide: 2,
    label: '',
    query: '',
    current: {},
    options: [],
    skipUrlSync: false,
    globalModel: null,
  };

  /** @ngInject */
  constructor(model, private variableSrv) {
    super();
    this.model = model;
    assignModelProperties(this, model, this.defaults);
  }

  setValue(option) {
    this.variableSrv.setOptionAsCurrent(this, option);
  }

  updateOptions() {
    this.options = [{ text: this.query.trim(), value: this.query.trim() }];
    this.current = this.options[0];
    return Promise.resolve();
  }

  dependsOn(variable) {
    return false;
  }

  setValueFromUrl(urlValue) {
    this.query = urlValue;
    return this.variableSrv.setOptionFromUrl(this, urlValue);
  }

  getValueForUrl() {
    return this.current.value;
  }
}

variableTypes['textbox'] = {
  name: 'Text box',
  ctor: TextBoxVariable,
  description: 'Define a textbox variable, where users can enter any arbitrary string',
};
