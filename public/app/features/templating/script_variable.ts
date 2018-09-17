import _ from 'lodash';
import { Variable, assignModelProperties, variableTypes } from './variable';
import * as dateMath from 'app/core/utils/datemath';

export class ScriptVariable implements Variable {
  query: string;
  options: any[];
  current: any;
  skipUrlSync: boolean;
  refresh: number;
  name: string;

  defaults = {
    type: 'script',
    name: '',
    hide: 2,
    label: '',
    query: 'with (options) {\n\treturn from;\n}',
    current: {},
    options: [],
    skipUrlSync: false,
    refresh: 2,
  };

  /** @ngInject */
  constructor(private model, private variableSrv) {
    assignModelProperties(this, model, this.defaults);
  }

  getSaveModel() {
    assignModelProperties(this.model, this, this.defaults);
    return this.model;
  }

  setValue(option) {
    this.variableSrv.setOptionAsCurrent(this, option);
  }

  updateOptions() {
    const options = {};

    options['from'] = dateMath.parse(this.variableSrv.dashboard.time.from).unix();
    options['to'] = dateMath.parse(this.variableSrv.dashboard.time.to).unix();
    options['now'] = dateMath.parse('now').unix();
    options['parsedate'] = text => dateMath.parse(text).unix();

    for (const variable of this.variableSrv.variables) {
      if (variable !== this) {
        options[variable.name] = variable.current.value;
      }
    }

    const func = new Function('options', this.query);

    let value: any;
    let text: any;
    const result = func(options);

    if (result instanceof Array) {
      if (result.length === 2) {
        value = result[0];
        text = result[1];
      } else {
        value = text = 'not enough items in array';
      }
    } else {
      value = text = result || 'undefined';
    }

    if (!(value instanceof String)) {
      value = String(value);
    }
    if (!(text instanceof String)) {
      text = String(text);
    }

    this.options = [{ text: text, value: value }];

    this.setValue(this.options[0]);
    return Promise.resolve();
  }

  dependsOn(variable) {
    return this.query.includes(variable.name) && variable.name !== this.name;
  }

  setValueFromUrl(urlValue) {
    return this.variableSrv.setOptionFromUrl(this, urlValue);
  }

  getValueForUrl() {
    return this.current.value;
  }
}

variableTypes['script'] = {
  name: 'Script Variable',
  ctor: ScriptVariable,
  description: 'calculate value from other variables',
};
