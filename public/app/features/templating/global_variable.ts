import _ from 'lodash';
import { Variable, assignModelProperties, variableTypes, VariableBase } from './variable';

export class GlobalVariable extends VariableBase implements Variable {
  uid: string;

  defaults = {
    type: 'global',
    uid: '',
    tags: [],
  };

  /** @ngInject */
  constructor(model, private variableSrv) {
    super();
    this.model = model;
    assignModelProperties(this, model, this.defaults);
  }

  getSaveModel() {
    assignModelProperties(this.model, this, this.defaults);
    return this.model;
  }

  setValue(option) {
    return this.variableSrv.setOptionAsCurrent(this, option);
  }

  updateOptions() {
    return Promise.resolve();
  }

  dependsOn(variable) {
    return false;
  }

  setValueFromUrl(urlValue) {
    return this.variableSrv.setOptionFromUrl(this, urlValue);
  }

  getValueForUrl() {
    return this.current.value;
  }
}

variableTypes['global'] = {
  name: 'Global',
  ctor: GlobalVariable,
  description: 'Reference to an global variable',
};
