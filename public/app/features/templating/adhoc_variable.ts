import _ from 'lodash';
import {
  AdHocVariableFilter,
  AdHocVariableModel,
  assignModelProperties,
  createVariableInState,
  getVariableModel,
  getVariablePropFromState,
  setVariablePropInState,
  VariableActions,
  VariableHide,
  VariableType,
  variableTypes,
} from './variable';

export class AdhocVariable implements AdHocVariableModel, VariableActions {
  id: number;
  defaults: AdHocVariableModel = {
    type: 'adhoc',
    name: '',
    label: '',
    hide: VariableHide.dontHide,
    skipUrlSync: false,
    datasource: null,
    filters: [],
  };
  temporary: AdHocVariableModel = null;

  /** @ngInject */
  constructor(private model: any) {
    if (model.useTemporary) {
      this.temporary = {} as AdHocVariableModel;
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
  get filters(): AdHocVariableFilter[] {
    return getVariablePropFromState<AdHocVariableFilter[]>(this.id, this.temporary, 'filters');
  }
  get datasource(): string {
    return getVariablePropFromState<string>(this.id, this.temporary, 'datasource');
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
  set filters(filters: AdHocVariableFilter[]) {
    setVariablePropInState(this.id, this.temporary, 'filters', filters);
  }
  set datasource(datasource: string) {
    setVariablePropInState(this.id, this.temporary, 'datasource', datasource);
  }

  setValue(option: any) {
    return Promise.resolve();
  }

  getSaveModel() {
    this.model = getVariableModel(this.id, this.temporary);
    return this.model;
  }

  updateOptions() {
    return Promise.resolve();
  }

  dependsOn(variable: any) {
    return false;
  }

  setValueFromUrl(urlValue: string[] | string[]) {
    if (!_.isArray(urlValue)) {
      urlValue = [urlValue];
    }

    this.filters = urlValue.map(item => {
      const values = item.split('|').map(value => {
        return this.unescapeDelimiter(value);
      });
      return {
        key: values[0],
        operator: values[1],
        value: values[2],
        condition: '',
      };
    });

    return Promise.resolve();
  }

  getValueForUrl() {
    return this.filters.map(filter => {
      return [filter.key, filter.operator, filter.value]
        .map(value => {
          return this.escapeDelimiter(value);
        })
        .join('|');
    });
  }

  escapeDelimiter(value: string) {
    return value.replace(/\|/g, '__gfp__');
  }

  unescapeDelimiter(value: string) {
    return value.replace(/__gfp__/g, '|');
  }

  setFilters(filters: any[]) {
    this.filters = filters;
  }
}

variableTypes['adhoc'] = {
  name: 'Ad hoc filters',
  ctor: AdhocVariable,
  description: 'Add key/value filters on the fly',
};
