///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';
import kbn from 'app/core/utils/kbn';
import {Variable, assignModelProperties, variableTypes} from './variable';
import {VariableSrv} from './variable_srv';

export class AdhocVariable implements Variable {

  defaults = {
    type: 'adhoc',
    name: '',
    label: '',
    hide: 0,
    datasource: null,
    options: [],
    current: {},
    tags: {},
  };

  /** @ngInject **/
  constructor(private model, private timeSrv, private templateSrv, private variableSrv) {
    assignModelProperties(this, model, this.defaults);
  }

  setValue(option) {
    return Promise.resolve();
  }

  getModel() {
    assignModelProperties(this.model, this, this.defaults);
    return this.model;
  }

  updateOptions() {
    return Promise.resolve();
  }

  dependsOn(variable) {
    return false;
  }

  setValueFromUrl(urlValue) {
    return Promise.resolve();
  }
}

variableTypes['adhoc'] = {
  name: 'Ad hoc',
  ctor: AdhocVariable,
  description: 'Ad hoc filters',
};
