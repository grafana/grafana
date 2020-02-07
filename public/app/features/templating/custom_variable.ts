import _ from 'lodash';
import {
  assignModelProperties,
  CustomVariableModel,
  VariableActions,
  VariableHide,
  VariableOption,
  VariableType,
  variableTypes,
} from './variable';
import { VariableSrv } from './variable_srv';

export class CustomVariable implements CustomVariableModel, VariableActions {
  type: VariableType;
  name: string;
  label: string;
  hide: VariableHide;
  skipUrlSync: boolean;
  query: string;
  options: VariableOption[];
  includeAll: boolean;
  multi: boolean;
  current: VariableOption;
  allValue: string;

  defaults: CustomVariableModel = {
    type: 'custom',
    name: '',
    label: '',
    hide: VariableHide.dontHide,
    skipUrlSync: false,
    query: '',
    options: [],
    includeAll: false,
    multi: false,
    current: {} as VariableOption,
    allValue: null,
  };

  /** @ngInject */
  constructor(private model: any, private variableSrv: VariableSrv) {
    assignModelProperties(this, model, this.defaults);
  }

  setValue(option: any) {
    return this.variableSrv.setOptionAsCurrent(this, option);
  }

  getSaveModel() {
    assignModelProperties(this.model, this, this.defaults);
    return this.model;
  }

  updateOptions() {
    // extract options in comma separated string (use backslash to escape wanted commas)
    this.options = _.map(this.query.match(/(?:\\,|[^,])+/g), text => {
      text = text.replace(/\\,/g, ',');
      return { text: text.trim(), value: text.trim(), selected: false };
    });

    if (this.includeAll) {
      this.addAllOption();
    }

    return this.variableSrv.validateVariableSelectionState(this);
  }

  addAllOption() {
    this.options.unshift({ text: 'All', value: '$__all', selected: false });
  }

  dependsOn(variable: any) {
    return false;
  }

  setValueFromUrl(urlValue: string[]) {
    return this.variableSrv.setOptionFromUrl(this, urlValue);
  }

  getValueForUrl() {
    if (this.current.text === 'All') {
      return 'All';
    }
    return this.current.value;
  }
}

variableTypes['custom'] = {
  name: 'Custom',
  ctor: CustomVariable,
  description: 'Define variable values manually',
  supportsMulti: true,
};
