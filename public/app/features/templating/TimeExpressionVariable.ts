import { Variable, assignModelProperties, variableTypes } from './variable';
import { VariableSrv } from './variable_srv';
import * as dateMath from '@grafana/data/src/utils/datemath';

export class TimeExpressionVariable implements Variable {
  query: string;
  current: any;
  options: any[];
  skipUrlSync: boolean;
  roundMethod: number;
  format: string;
  refresh: number;

  defaults = {
    type: 'timeexpression',
    name: '',
    hide: 0,
    label: '',
    refresh: 2,
    query: 'now/d',
    current: {},
    options: [],
    skipUrlSync: false,
    roundMethod: 0,
    format: '',
  };

  /** @ngInject */
  constructor(private model: any, private variableSrv: VariableSrv) {
    assignModelProperties(this, model, this.defaults);
    this.refresh = 2;
  }

  getSaveModel() {
    assignModelProperties(this.model, this, this.defaults);
    return this.model;
  }

  setValue(option: any) {
    this.variableSrv.setOptionAsCurrent(this, option);
  }

  updateOptions() {
    const time = this.getFormattedDatetime(this.query.trim(), this.format);
    this.options = [{ text: this.query.trim(), value: time }];
    this.current = this.options[0];
    return Promise.resolve();
  }

  dependsOn(variable: any) {
    return false;
  }

  setValueFromUrl(urlValue: string) {
    const time = this.getFormattedDatetime(urlValue, this.format);
    this.current = { text: urlValue, value: time };
    return this.variableSrv.setOptionFromUrl(this, urlValue);
  }

  getValueForUrl() {
    const time = this.getFormattedDatetime(this.current.text, this.format);
    this.current = { text: this.current.text, value: time };
    return this.current.text;
  }

  getFormattedDatetime(date: string, format: string) {
    const timezone = this.variableSrv.dashboard && this.variableSrv.dashboard.getTimezone();
    const dateTime = dateMath.parse(date, this.roundMethod !== 0, timezone);
    return dateTime.format(format);
  }
}

variableTypes['timeexpression'] = {
  name: 'Time expression',
  ctor: TimeExpressionVariable,
  description: 'Enabled you to dynamically calculate a datetime according to the current time',
  supportsMulti: false,
};
