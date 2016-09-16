///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';
import kbn from 'app/core/utils/kbn';
import {Variable} from './variable';
import {VariableSrv, variableConstructorMap} from './variable_srv';

export class IntervalVariable implements Variable {
  auto_count: number;
  auto_min: number;
  options: any;
  auto: boolean;
  query: string;

  /** @ngInject */
  constructor(private model, private timeSrv, private templateSrv) {
    _.extend(this, model);
  }

  setValue(option) {
    if (this.auto) {
      this.updateAutoValue();
    }
  }

  updateAutoValue() {
    // add auto option if missing
    if (this.options.length && this.options[0].text !== 'auto') {
      this.options.unshift({ text: 'auto', value: '$__auto_interval' });
    }

    var interval = kbn.calculateInterval(this.timeSrv.timeRange(), this.auto_count, (this.auto_min ? ">"+this.auto_min : null));
    this.templateSrv.setGrafanaVariable('$__auto_interval', interval);
  }

  updateOptions() {
   // extract options in comma separated string
    this.options = _.map(this.query.split(/[,]+/), function(text) {
      return {text: text.trim(), value: text.trim()};
    });

    if (this.auto) {
      this.updateAutoValue();
    }
  }

  dependsOn(variableName) {
    return false;
  }
}

variableConstructorMap['interval'] = IntervalVariable;
