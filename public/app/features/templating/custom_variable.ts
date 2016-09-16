///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';
import kbn from 'app/core/utils/kbn';
import {Variable} from './variable';
import {VariableSrv, variableConstructorMap} from './variable_srv';

export class CustomVariable implements Variable {
  query: string;
  options: any;
  includeAll: boolean;

  /** @ngInject */
  constructor(private model, private timeSrv, private templateSrv) {
    _.extend(this, model);
  }

  setValue(option) {
  }

  updateOptions() {
    // extract options in comma separated string
    this.options = _.map(this.query.split(/[,]+/), function(text) {
      return { text: text.trim(), value: text.trim() };
    });

    if (this.includeAll) {
      this.addAllOption();
    }
  }

  addAllOption() {
    this.options.unshift({text: 'All', value: "$__all"});
  }

  dependsOn(variableName) {
    return false;
  }
}

variableConstructorMap['custom'] = CustomVariable;
