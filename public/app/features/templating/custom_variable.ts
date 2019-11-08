import _ from 'lodash';
import {
  assignModelProperties,
  createVariableInState,
  CustomVariableModel,
  getVariableModel,
  getVariablePropFromState,
  setVariablePropInState,
  VariableActions,
  VariableHide,
  VariableOption,
  VariableType,
  variableTypes,
} from './variable';
import { VariableSrv } from './variable_srv';

export class CustomVariable implements CustomVariableModel, VariableActions {
  id: number;
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
  temporary: CustomVariableModel = null;

  /** @ngInject */
  constructor(private model: any, private variableSrv: VariableSrv) {
    if (model.useTemporary) {
      this.temporary = {} as CustomVariableModel;
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
  get query(): string {
    return getVariablePropFromState<string>(this.id, this.temporary, 'query');
  }
  get options(): VariableOption[] {
    return getVariablePropFromState<VariableOption[]>(this.id, this.temporary, 'options');
  }
  get includeAll(): boolean {
    return getVariablePropFromState<boolean>(this.id, this.temporary, 'includeAll');
  }
  get multi(): boolean {
    return getVariablePropFromState<boolean>(this.id, this.temporary, 'multi');
  }
  get current(): VariableOption {
    return getVariablePropFromState<VariableOption>(this.id, this.temporary, 'current');
  }
  get allValue(): string {
    return getVariablePropFromState<string>(this.id, this.temporary, 'allValue');
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
  set query(query: string) {
    setVariablePropInState(this.id, this.temporary, 'query', query);
  }
  set options(options: VariableOption[]) {
    setVariablePropInState(this.id, this.temporary, 'options', options);
  }
  set includeAll(includeAll: boolean) {
    setVariablePropInState(this.id, this.temporary, 'includeAll', includeAll);
  }
  set multi(multi: boolean) {
    setVariablePropInState(this.id, this.temporary, 'multi', multi);
  }
  set current(current: VariableOption) {
    setVariablePropInState(this.id, this.temporary, 'current', current);
  }
  set allValue(allValue: string) {
    setVariablePropInState(this.id, this.temporary, 'allValue', allValue);
  }

  setValue(option: any) {
    return this.variableSrv.setOptionAsCurrent(this, option);
  }

  getSaveModel() {
    this.model = getVariableModel(this.id, this.temporary);
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
