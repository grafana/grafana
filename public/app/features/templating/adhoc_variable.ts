import _ from 'lodash';
import { Variable, assignModelProperties, variableTypes } from './variable';

export class AdhocVariable implements Variable {
  filters: any[];
  skipUrlSync: boolean;

  defaults = {
    type: 'adhoc',
    name: '',
    label: '',
    hide: 0,
    datasource: null,
    filters: [],
    skipUrlSync: false,
  };

  /** @ngInject */
  constructor(private model) {
    assignModelProperties(this, model, this.defaults);
  }

  setValue(option) {
    return Promise.resolve();
  }

  getSaveModel() {
    assignModelProperties(this.model, this, this.defaults);
    return this.model;
  }

  updateOptions() {
    return Promise.resolve();
  }

  dependsOn(variable) {
    return false;
  }

  setValueFromUrl(urlValue) {
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

  escapeDelimiter(value) {
    return value.replace(/\|/g, '__gfp__');
  }

  unescapeDelimiter(value) {
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
