import _ from 'lodash';
import kbn from 'app/core/utils/kbn';
import {
  assignModelProperties,
  IntervalVariableModel,
  VariableActions,
  VariableHide,
  VariableOption,
  VariableRefresh,
  VariableType,
  variableTypes,
} from './types';
import { TimeSrv } from '../dashboard/services/TimeSrv';
import { TemplateSrv } from './template_srv';
import { VariableSrv } from './variable_srv';

export class IntervalVariable implements IntervalVariableModel, VariableActions {
  type: VariableType;
  name: string;
  label: string;
  hide: VariableHide;
  skipUrlSync: boolean;
  auto_count: number; // eslint-disable-line camelcase
  auto_min: string; // eslint-disable-line camelcase
  options: VariableOption[];
  auto: boolean;
  query: string;
  refresh: VariableRefresh;
  current: VariableOption;

  defaults: IntervalVariableModel = {
    type: 'interval',
    name: '',
    label: '',
    hide: VariableHide.dontHide,
    skipUrlSync: false,
    auto_count: 30,
    auto_min: '10s',
    options: [],
    auto: false,
    query: '1m,10m,30m,1h,6h,12h,1d,7d,14d,30d',
    refresh: VariableRefresh.onTimeRangeChanged,
    current: {} as VariableOption,
  };

  /** @ngInject */
  constructor(
    private model: any,
    private timeSrv: TimeSrv,
    private templateSrv: TemplateSrv,
    private variableSrv: VariableSrv
  ) {
    assignModelProperties(this, model, this.defaults);
    this.refresh = VariableRefresh.onTimeRangeChanged;
  }

  getSaveModel() {
    assignModelProperties(this.model, this, this.defaults);
    return this.model;
  }

  setValue(option: any) {
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
        selected: false,
      });
    }

    const res = kbn.calculateInterval(this.timeSrv.timeRange(), this.auto_count, this.auto_min);
    this.templateSrv.setGrafanaVariable('$__auto_interval_' + this.name, res.interval);
    // for backward compatibility, to be removed eventually
    this.templateSrv.setGrafanaVariable('$__auto_interval', res.interval);
  }

  updateOptions() {
    // extract options between quotes and/or comma
    this.options = _.map(this.query.match(/(["'])(.*?)\1|\w+/g), text => {
      text = text.replace(/["']+/g, '');
      return { text: text.trim(), value: text.trim(), selected: false };
    });

    this.updateAutoValue();
    return this.variableSrv.validateVariableSelectionState(this);
  }

  dependsOn(variable: any) {
    return false;
  }

  setValueFromUrl(urlValue: string | string[]) {
    this.updateAutoValue();
    return this.variableSrv.setOptionFromUrl(this, urlValue);
  }

  getValueForUrl() {
    return this.current.value;
  }
}

// @ts-ignore
variableTypes['interval'] = {
  name: 'Interval',
  ctor: IntervalVariable,
  description: 'Define a timespan interval (ex 1m, 1h, 1d)',
};
