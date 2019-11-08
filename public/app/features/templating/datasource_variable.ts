import {
  assignModelProperties,
  containsVariable,
  createVariableInState,
  DataSourceVariableModel,
  getVariableModel,
  getVariablePropFromState,
  QueryVariableModel,
  setVariablePropInState,
  VariableActions,
  VariableHide,
  VariableOption,
  VariableRefresh,
  VariableType,
  variableTypes,
} from './variable';
import { stringToJsRegex } from '@grafana/data';
import { VariableSrv } from './variable_srv';
import { TemplateSrv } from './template_srv';
import { DatasourceSrv } from '../plugins/datasource_srv';

export class DatasourceVariable implements VariableActions {
  id: number;
  defaults: DataSourceVariableModel = {
    type: 'datasource',
    name: '',
    hide: VariableHide.dontHide,
    label: '',
    current: {} as VariableOption,
    regex: '',
    options: [],
    query: '',
    multi: false,
    includeAll: false,
    refresh: VariableRefresh.onDashboardLoad,
    skipUrlSync: false,
  };
  temporary: DataSourceVariableModel = null;

  /** @ngInject */
  constructor(
    private model: any,
    private datasourceSrv: DatasourceSrv,
    private variableSrv: VariableSrv,
    private templateSrv: TemplateSrv
  ) {
    if (model.useTemporary) {
      this.temporary = {} as QueryVariableModel;
      assignModelProperties(this.temporary, model, this.defaults);
      this.id = -1;
    } else {
      this.temporary = null;
      this.id = createVariableInState(model, this.defaults);
    }
    this.refresh = 1;
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
  get regex(): string {
    return getVariablePropFromState<string>(this.id, this.temporary, 'regex');
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
  get multi(): boolean {
    return getVariablePropFromState<boolean>(this.id, this.temporary, 'multi');
  }
  get includeAll(): boolean {
    return getVariablePropFromState<boolean>(this.id, this.temporary, 'includeAll');
  }
  get refresh(): VariableRefresh {
    return getVariablePropFromState<VariableRefresh>(this.id, this.temporary, 'refresh');
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
  set regex(regex: string) {
    setVariablePropInState(this.id, this.temporary, 'regex', regex);
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
  set multi(multi: boolean) {
    setVariablePropInState(this.id, this.temporary, 'multi', multi);
  }
  set includeAll(includeAll: boolean) {
    setVariablePropInState(this.id, this.temporary, 'includeAll', includeAll);
  }
  set refresh(refresh: VariableRefresh) {
    setVariablePropInState(this.id, this.temporary, 'refresh', refresh);
  }

  getSaveModel() {
    this.model = getVariableModel(this.id, this.temporary);

    // don't persist options
    this.model.options = [];
    return this.model;
  }

  setValue(option: any) {
    return this.variableSrv.setOptionAsCurrent(this, option);
  }

  updateOptions() {
    const options: VariableOption[] = [];
    const sources = this.datasourceSrv.getMetricSources({ skipVariables: true });
    let regex;

    if (this.regex) {
      regex = this.templateSrv.replace(this.regex, null, 'regex');
      regex = stringToJsRegex(regex);
    }

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      // must match on type
      if (source.meta.id !== this.query) {
        continue;
      }

      if (regex && !regex.exec(source.name)) {
        continue;
      }

      options.push({ text: source.name, value: source.name, selected: false });
    }

    if (options.length === 0) {
      options.push({ text: 'No data sources found', value: '', selected: false });
    }

    this.options = options;
    if (this.includeAll) {
      this.addAllOption();
    }
    return this.variableSrv.validateVariableSelectionState(this);
  }

  addAllOption() {
    this.options.unshift({ text: 'All', value: '$__all', selected: false });
  }

  dependsOn(variable: any) {
    if (this.regex) {
      return containsVariable(this.regex, variable.name);
    }
    return false;
  }

  setValueFromUrl(urlValue: string | string[]) {
    return this.variableSrv.setOptionFromUrl(this, urlValue);
  }

  getValueForUrl() {
    if (this.current.text === 'All') {
      return 'All';
    }
    return this.current.value;
  }
}

variableTypes['datasource'] = {
  name: 'Datasource',
  ctor: DatasourceVariable,
  supportsMulti: true,
  description: 'Enabled you to dynamically switch the datasource for multiple panels',
};
