import {
  assignModelProperties,
  ConstantVariableModel,
  createVariableInState,
  getVariableModel,
  getVariablePropFromState,
  setVariablePropInState,
  VariableActions,
  VariableHide,
  VariableOption,
  VariableType,
  variableTypes,
} from './variable';
import { VariableSrv } from './all';

export class ConstantVariable implements ConstantVariableModel, VariableActions {
  id: number;
  defaults: ConstantVariableModel = {
    type: 'constant',
    name: '',
    hide: VariableHide.hideLabel,
    label: '',
    query: '',
    current: {} as VariableOption,
    options: [],
    skipUrlSync: false,
  };
  temporary: ConstantVariableModel = null;

  /** @ngInject */
  constructor(private model: any, private variableSrv: VariableSrv) {
    if (model.useTemporary) {
      this.temporary = {} as ConstantVariableModel;
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
  get current(): VariableOption {
    return getVariablePropFromState<VariableOption>(this.id, this.temporary, 'current');
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
  set current(current: VariableOption) {
    setVariablePropInState(this.id, this.temporary, 'current', current);
  }

  getSaveModel() {
    this.model = getVariableModel(this.id, this.temporary);
    return this.model;
  }

  setValue(option: any) {
    this.variableSrv.setOptionAsCurrent(this, option);
  }

  updateOptions() {
    this.options = [{ text: this.query.trim(), value: this.query.trim(), selected: false }];
    this.setValue(this.options[0]);
    return Promise.resolve();
  }

  dependsOn(variable: any) {
    return false;
  }

  setValueFromUrl(urlValue: string) {
    return this.variableSrv.setOptionFromUrl(this, urlValue);
  }

  getValueForUrl() {
    return this.current.value;
  }
}

variableTypes['constant'] = {
  name: 'Constant',
  ctor: ConstantVariable,
  description: 'Define a hidden constant variable, useful for metric prefixes in dashboards you want to share',
};
