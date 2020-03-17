import _ from 'lodash';
import {
  AdHocVariableFilter,
  AdHocVariableModel,
  assignModelProperties,
  VariableActions,
  VariableHide,
  VariableType,
  variableTypes,
} from './variable';

export class AdhocVariable implements AdHocVariableModel, VariableActions {
  type: VariableType;
  name: string;
  label: string;
  hide: VariableHide;
  skipUrlSync: boolean;
  filters: AdHocVariableFilter[];
  datasource: string;

  defaults: AdHocVariableModel = {
    type: 'adhoc',
    name: '',
    label: '',
    hide: VariableHide.dontHide,
    skipUrlSync: false,
    datasource: null,
    filters: [],
  };

  /** @ngInject */
  constructor(private model: any) {
    assignModelProperties(this, model, this.defaults);
  }

  setValue(option: any) {
    return Promise.resolve();
  }

  getSaveModel() {
    assignModelProperties(this.model, this, this.defaults);
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
