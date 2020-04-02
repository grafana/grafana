import _ from 'lodash';
import {
  assignModelProperties,
  QueryVariableModel,
  VariableActions,
  VariableHide,
  VariableOption,
  VariableRefresh,
  VariableSort,
  VariableTag,
  VariableType,
  variableTypes,
} from './types';
import { DataSourceApi, stringToJsRegex } from '@grafana/data';
import DatasourceSrv from '../plugins/datasource_srv';
import { TemplateSrv } from './template_srv';
import { VariableSrv } from './variable_srv';
import { TimeSrv } from '../dashboard/services/TimeSrv';
import { containsVariable } from './utils';

function getNoneOption(): VariableOption {
  return { text: 'None', value: '', isNone: true, selected: false };
}

export class QueryVariable implements QueryVariableModel, VariableActions {
  type: VariableType;
  name: string;
  label: string | null;
  hide: VariableHide;
  skipUrlSync: boolean;
  datasource: string | null;
  query: string;
  regex: string;
  sort: VariableSort;
  options: VariableOption[];
  current: VariableOption;
  refresh: VariableRefresh;
  multi: boolean;
  includeAll: boolean;
  useTags: boolean;
  tagsQuery: string;
  tagValuesQuery: string;
  tags: VariableTag[];
  definition: string;
  allValue: string;
  index: number;

  defaults: QueryVariableModel = {
    type: 'query',
    name: '',
    label: null,
    hide: VariableHide.dontHide,
    skipUrlSync: false,
    datasource: null,
    query: '',
    regex: '',
    sort: VariableSort.disabled,
    refresh: VariableRefresh.never,
    multi: false,
    includeAll: false,
    allValue: null,
    options: [],
    current: {} as VariableOption,
    tags: [],
    useTags: false,
    tagsQuery: '',
    tagValuesQuery: '',
    definition: '',
    index: -1,
  };

  /** @ngInject */
  constructor(
    private model: any,
    private datasourceSrv: DatasourceSrv,
    private templateSrv: TemplateSrv,
    private variableSrv: VariableSrv,
    private timeSrv: TimeSrv
  ) {
    // copy model properties to this instance
    assignModelProperties(this, model, this.defaults);
    this.updateOptionsFromMetricFindQuery.bind(this);
  }

  getSaveModel() {
    // copy back model properties to model
    assignModelProperties(this.model, this, this.defaults);

    // remove options
    if (this.refresh !== 0) {
      this.model.options = [];
    }

    return this.model;
  }

  setValue(option: any) {
    return this.variableSrv.setOptionAsCurrent(this, option);
  }

  setValueFromUrl(urlValue: any) {
    return this.variableSrv.setOptionFromUrl(this, urlValue);
  }

  getValueForUrl() {
    if (this.current.text === 'All') {
      return 'All';
    }
    return this.current.value;
  }

  updateOptions(searchFilter?: string) {
    return this.datasourceSrv
      .get(this.datasource ?? '')
      .then((ds: DataSourceApi) => this.updateOptionsFromMetricFindQuery(ds, searchFilter))
      .then(this.updateTags.bind(this))
      .then(this.variableSrv.validateVariableSelectionState.bind(this.variableSrv, this));
  }

  updateTags(datasource: any) {
    if (this.useTags) {
      return this.metricFindQuery(datasource, this.tagsQuery).then((results: any[]) => {
        this.tags = [];
        for (let i = 0; i < results.length; i++) {
          this.tags.push(results[i].text);
        }
        return datasource;
      });
    } else {
      delete this.tags;
    }

    return datasource;
  }

  getValuesForTag(tagKey: string) {
    return this.datasourceSrv.get(this.datasource ?? '').then((datasource: DataSourceApi) => {
      const query = this.tagValuesQuery.replace('$tag', tagKey);
      return this.metricFindQuery(datasource, query).then((results: any) => {
        return _.map(results, value => {
          return value.text;
        });
      });
    });
  }

  updateOptionsFromMetricFindQuery(datasource: any, searchFilter?: string) {
    return this.metricFindQuery(datasource, this.query, searchFilter).then((results: any) => {
      this.options = this.metricNamesToVariableValues(results);
      if (this.includeAll) {
        this.addAllOption();
      }
      if (!this.options.length) {
        this.options.push(getNoneOption());
      }
      return datasource;
    });
  }

  metricFindQuery(datasource: any, query: string, searchFilter?: string) {
    const options: any = { range: undefined, variable: this, searchFilter };

    if (this.refresh === 2) {
      options.range = this.timeSrv.timeRange();
    }

    return datasource.metricFindQuery(query, options);
  }

  addAllOption() {
    this.options.unshift({ text: 'All', value: '$__all', selected: false });
  }

  metricNamesToVariableValues(metricNames: any[]) {
    let regex, options, i, matches;
    options = [];

    if (this.regex) {
      regex = stringToJsRegex(this.templateSrv.replace(this.regex, {}, 'regex'));
    }
    for (i = 0; i < metricNames.length; i++) {
      const item = metricNames[i];
      let text = item.text === undefined || item.text === null ? item.value : item.text;

      let value = item.value === undefined || item.value === null ? item.text : item.value;

      if (_.isNumber(value)) {
        value = value.toString();
      }

      if (_.isNumber(text)) {
        text = text.toString();
      }

      if (regex) {
        matches = regex.exec(value);
        if (!matches) {
          continue;
        }
        if (matches.length > 1) {
          value = matches[1];
          text = matches[1];
        }
      }

      options.push({ text: text, value: value });
    }

    options = _.uniqBy(options, 'value');
    return this.sortVariableValues(options, this.sort);
  }

  sortVariableValues(options: any[], sortOrder: number) {
    if (sortOrder === 0) {
      return options;
    }

    const sortType = Math.ceil(sortOrder / 2);
    const reverseSort = sortOrder % 2 === 0;

    if (sortType === 1) {
      options = _.sortBy(options, 'text');
    } else if (sortType === 2) {
      options = _.sortBy(options, opt => {
        const matches = opt.text.match(/.*?(\d+).*/);
        if (!matches || matches.length < 2) {
          return -1;
        } else {
          return parseInt(matches[1], 10);
        }
      });
    } else if (sortType === 3) {
      options = _.sortBy(options, opt => {
        return _.toLower(opt.text);
      });
    }

    if (reverseSort) {
      options = options.reverse();
    }

    return options;
  }

  dependsOn(variable: any) {
    return containsVariable(this.query, this.datasource, this.regex, variable.name);
  }
}
// @ts-ignore
variableTypes['query'] = {
  name: 'Query',
  ctor: QueryVariable,
  description: 'Variable values are fetched from a datasource query',
  supportsMulti: true,
};
