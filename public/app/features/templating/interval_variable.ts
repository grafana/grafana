import _ from 'lodash';
import kbn from 'app/core/utils/kbn';
import {
  assignModelProperties,
  createVariableInState,
  getVariableModel,
  getVariablePropFromState,
  IntervalVariableModel,
  setVariablePropInState,
  VariableActions,
  VariableHide,
  VariableOption,
  VariableRefresh,
  VariableType,
  variableTypes,
} from './variable';
import { TimeSrv } from '../dashboard/services/TimeSrv';
import { TemplateSrv } from './template_srv';
import { VariableSrv } from './variable_srv';

export class IntervalVariable implements IntervalVariableModel, VariableActions {
  id: number;
  defaults: IntervalVariableModel = {
    id: -1,
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
  temporary: IntervalVariableModel = null;

  /** @ngInject */
  constructor(
    private model: any,
    private timeSrv: TimeSrv,
    private templateSrv: TemplateSrv,
    private variableSrv: VariableSrv
  ) {
    if (model.useTemporary) {
      this.temporary = {} as IntervalVariableModel;
      assignModelProperties(this.temporary, model, this.defaults);
      this.id = -1;
    } else {
      this.temporary = null;
      this.id = createVariableInState(model, this.defaults);
    }
  }

  get type(): VariableType {
    return getVariablePropFromState<VariableType>(this.id, this.temporary, 'type');
  }
  get name(): string {
    return getVariablePropFromState<string>(this.id, this.temporary, 'name');
  }
  get label(): string {
    return getVariablePropFromState<string>(this.id, this.temporary, 'label');
  }
  get hide(): VariableHide {
    return getVariablePropFromState<VariableHide>(this.id, this.temporary, 'hide');
  }
  get skipUrlSync(): boolean {
    return getVariablePropFromState<boolean>(this.id, this.temporary, 'skipUrlSync');
  }
  get auto_count(): number {
    return getVariablePropFromState(this.id, this.temporary, 'auto_count');
  }
  get auto_min(): string {
    return getVariablePropFromState(this.id, this.temporary, 'auto_min');
  }
  get options(): VariableOption[] {
    return getVariablePropFromState(this.id, this.temporary, 'options');
  }
  get auto(): boolean {
    return getVariablePropFromState(this.id, this.temporary, 'auto');
  }
  get query(): string {
    return getVariablePropFromState(this.id, this.temporary, 'query');
  }
  get refresh(): VariableRefresh {
    return getVariablePropFromState(this.id, this.temporary, 'refresh');
  }
  get current(): VariableOption {
    return getVariablePropFromState(this.id, this.temporary, 'current');
  }

  set type(type: VariableType) {
    setVariablePropInState(this.id, this.temporary, 'type', type);
  }
  set name(name: string) {
    setVariablePropInState(this.id, this.temporary, 'name', name);
  }
  set label(label: string) {
    setVariablePropInState(this.id, this.temporary, 'label', label);
  }
  set hide(hide: VariableHide) {
    setVariablePropInState(this.id, this.temporary, 'hide', hide);
  }
  set skipUrlSync(skipUrlSync: boolean) {
    setVariablePropInState(this.id, this.temporary, 'skipUrlSync', skipUrlSync);
  }
  set auto_count(autoCount: number) {
    setVariablePropInState(this.id, this.temporary, 'auto_count', autoCount);
  }
  set auto_min(autoMin: string) {
    setVariablePropInState(this.id, this.temporary, 'auto_min', autoMin);
  }
  set options(options: VariableOption[]) {
    setVariablePropInState(this.id, this.temporary, 'options', options);
  }
  set auto(auto: boolean) {
    setVariablePropInState(this.id, this.temporary, 'auto', auto);
  }
  set query(query: string) {
    setVariablePropInState(this.id, this.temporary, 'query', query);
  }
  set refresh(refresh: VariableRefresh) {
    setVariablePropInState(this.id, this.temporary, 'refresh', refresh);
  }
  set current(current: VariableOption) {
    setVariablePropInState(this.id, this.temporary, 'current', current);
  }

  getSaveModel() {
    this.model = getVariableModel(this.id, this.temporary);
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
