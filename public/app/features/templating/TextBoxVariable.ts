import { Variable, assignModelProperties, variableTypes } from './variable';

export class TextBoxVariable implements Variable {
  query: string;
  current: any;
  options: any[];
  onempty: string;
  viewonempty: boolean;
  skipUrlSync: boolean;

  defaults = {
    type: 'textbox',
    name: '',
    hide: 2,
    label: '',
    query: '',
    onempty: '',
    viewonempty: false,
    current: {},
    options: [],
    skipUrlSync: false,
  };

  /** @ngInject */
  constructor(private model, private variableSrv) {
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
    this.options = [{ text: this.query.trim(), value: this.query.trim() }];
    this.current = this.options[0];
    if (this.current.value === '' && this.onempty !== '') {
      this.options = [{ text: this.onempty.trim(), value: this.onempty.trim() }];
      this.current = this.options[0];
      if (this.viewonempty) {
        this.query = this.onempty;
      }
    } else {
      this.options = [{ text: this.query.trim(), value: this.query.trim() }];
      this.current = this.options[0];
    }
    return Promise.resolve();
  }

  dependsOn(variable) {
    return false;
  }

  setValueFromUrl(urlValue) {
    if (urlValue === '' && this.onempty !== '') {
      this.query = this.onempty;
      return this.variableSrv.setOptionFromUrl(this, this.onempty);
    } else {
      this.query = urlValue;
      return this.variableSrv.setOptionFromUrl(this, urlValue);
    }
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
