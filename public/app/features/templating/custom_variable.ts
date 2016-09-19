///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';
import kbn from 'app/core/utils/kbn';
import {Variable, assignModelProperties} from './variable';
import {VariableSrv, variableConstructorMap} from './variable_srv';

export class CustomVariable implements Variable {
  query: string;
  options: any;
  includeAll: boolean;
  multi: boolean;

  defaults = {
    type: 'custom',
    name: '',
    label: '',
    hide: 0,
    options: [],
    current: {text: '', value: ''},
    query: '',
    includeAll: false,
    multi: false,
  };

  /** @ngInject */
  constructor(private model, private timeSrv, private templateSrv, private variableSrv) {
    assignModelProperties(this, model, this.defaults);
  }

  setValue(option) {
    this.variableSrv.setOptionAsCurrent(this, option);
  }

  getModel() {
    assignModelProperties(this.model, this, this.defaults);
    return this.model;
  }

  updateOptions() {
    // extract options in comma separated string
    this.options = _.map(this.query.split(/[,]+/), function(text) {
      return { text: text.trim(), value: text.trim() };
    });

    if (this.includeAll) {
      this.addAllOption();
    }

    return Promise.resolve();
  }

  addAllOption() {
    this.options.unshift({text: 'All', value: "$__all"});
  }

  dependsOn(variable) {
    return false;
  }

  setValueFromUrl(urlValue) {
    return this.variableSrv.setOptionFromUrl(this, urlValue);
  }
}

variableConstructorMap['custom'] = CustomVariable;
