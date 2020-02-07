import {
  assignModelProperties,
  ConstantVariableModel,
  VariableActions,
  VariableHide,
  VariableOption,
  VariableType,
  variableTypes,
} from './variable';
import { VariableSrv } from './all';

export class ConstantVariable implements ConstantVariableModel, VariableActions {
  type: VariableType;
  name: string;
  label: string;
  hide: VariableHide;
  skipUrlSync: boolean;
  query: string;
  options: VariableOption[];
  current: VariableOption;

  defaults: ConstantVariableModel = {
    type: 'constant',
    name: '',
    hide: VariableHide.hideLabel,
    label: '',
    query: '',
    current: {} as VariableOption,
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
    this.options = [{ text: this.query.trim(), value: this.query.trim(), selected: false }];
    this.setValue(this.options[0]);
    return Promise.resolve();
  }

  dependsOn(variable: any) {
    return false;
  }

  setValueFromUrl(urlValue: string) {
    return this.variableSrv.setOptionFromUrl(this, urlValue);
  }

  getValueForUrl() {
    return this.current.value;
  }
}

variableTypes['constant'] = {
  name: 'Constant',
  ctor: ConstantVariable,
  description: 'Define a hidden constant variable, useful for metric prefixes in dashboards you want to share',
};
