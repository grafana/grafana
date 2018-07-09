import _ from 'lodash';
import kbn from 'app/core/utils/kbn';
import { Variable, assignModelProperties, variableTypes } from './variable';

export class IntervalVariable implements Variable {
  name: string;
  auto_count: number;
  auto_min: number;
  options: any;
  auto: boolean;
  query: string;
  refresh: number;
  current: any;
  skipUrlSync: boolean;

  defaults = {
    type: 'interval',
    name: '',
    hide: 0,
    label: '',
    refresh: 2,
    options: [],
    current: {},
    query: '1m,10m,30m,1h,6h,12h,1d,7d,14d,30d',
    auto: false,
    auto_min: '10s',
    auto_count: 30,
    skipUrlSync: false,
  };

  /** @ngInject **/
  constructor(private model, private timeSrv, private templateSrv, private variableSrv) {
    assignModelProperties(this, model, this.defaults);
    this.refresh = 2;
  }

  getSaveModel() {
    assignModelProperties(this.model, this, this.defaults);
    return this.model;
  }

  setValue(option) {
    this.updateAutoValue();
    return this.variableSrv.setOptionAsCurrent(this, option);
  }

  updateAutoValue() {
    if (!this.auto) {
      return;
    }

    // add auto option if missing
    if (this.options.length && this.options[0].text !== 'auto') {
      this.options.unshift({
        text: 'auto',
        value: '$__auto_interval_' + this.name,
      });
    }

    var res = kbn.calculateInterval(this.timeSrv.timeRange(), this.auto_count, this.auto_min);
    this.templateSrv.setGrafanaVariable('$__auto_interval_' + this.name, res.interval);
    // for backward compatibility, to be removed eventually
    this.templateSrv.setGrafanaVariable('$__auto_interval', res.interval);
  }

  updateOptions() {
    // extract options between quotes and/or comma
    this.options = _.map(this.query.match(/(["'])(.*?)\1|\w+/g), function(text) {
      text = text.replace(/["']+/g, '');
      return { text: text.trim(), value: text.trim() };
    });

    this.updateAutoValue();
    return this.variableSrv.validateVariableSelectionState(this);
  }

  dependsOn(variable) {
    return false;
  }

  setValueFromUrl(urlValue) {
    this.updateAutoValue();
    return this.variableSrv.setOptionFromUrl(this, urlValue);
  }

  getValueForUrl() {
    return this.current.value;
  }
}

variableTypes['interval'] = {
  name: 'Interval',
  ctor: IntervalVariable,
  description: 'Define a timespan interval (ex 1m, 1h, 1d)',
};
