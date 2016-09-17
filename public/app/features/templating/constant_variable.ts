///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';
import {Variable} from './variable';
import {VariableSrv, variableConstructorMap} from './variable_srv';

export class ConstantVariable implements Variable {
  query: string;
  options: any[];

  /** @ngInject */
  constructor(private model, private variableSrv) {
    _.extend(this, model);
  }

  setValue(option) {
    this.variableSrv.setOptionAsCurrent(this, option);
  }

  updateOptions() {
    this.options = [{text: this.query.trim(), value: this.query.trim()}];
    this.setValue(this.options[0]);
  }

  dependsOn(variable) {
    return false;
  }

  setValueFromUrl(urlValue) {
    return this.variableSrv.setOptionFromUrl(this, urlValue);
  }
}

variableConstructorMap['constant'] = ConstantVariable;
