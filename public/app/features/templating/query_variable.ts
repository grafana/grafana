import _ from 'lodash';
import {
  assignModelProperties,
  containsVariable,
  createVariableInState,
  getVariablePropFromState,
  QueryVariableModel,
  setVariablePropInState,
  VariableActions,
  VariableHide,
  VariableOption,
  VariableRefresh,
  VariableSort,
  VariableTag,
  VariableType,
  variableTypes,
} from './variable';
import { stringToJsRegex } from '@grafana/data';
import DatasourceSrv from '../plugins/datasource_srv';
import { TemplateSrv } from './template_srv';
import { VariableSrv } from './variable_srv';
import { TimeSrv } from '../dashboard/services/TimeSrv';

function getNoneOption(): VariableOption {
  return { text: 'None', value: '', isNone: true, selected: false };
}

export class QueryVariable implements QueryVariableModel, VariableActions {
  id: number;
  defaults: QueryVariableModel = {
    id: -1,
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
  };
  temporary: QueryVariableModel = null;

  /** @ngInject */
  constructor(
    private model: any,
    private datasourceSrv: DatasourceSrv,
    private templateSrv: TemplateSrv,
    private variableSrv: VariableSrv,
    private timeSrv: TimeSrv
  ) {
    // copy model properties to this instance
    if (model.isTemporary) {
      this.temporary = {} as QueryVariableModel;
      assignModelProperties(this.temporary, model, this.defaults);
    } else {
      this.temporary = null;
      this.id = createVariableInState(model, this.defaults);
    }
    this.updateOptionsFromMetricFindQuery.bind(this);
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
  get datasource(): string {
    return getVariablePropFromState<string>(this.id, this.temporary, 'datasource');
  }
  get query(): string {
    return getVariablePropFromState<string>(this.id, this.temporary, 'query');
  }
  get regex(): string {
    return getVariablePropFromState<string>(this.id, this.temporary, 'regex');
  }
  get sort(): VariableSort {
    return getVariablePropFromState<VariableSort>(this.id, this.temporary, 'sort');
  }
  get options(): VariableOption[] {
    return getVariablePropFromState<VariableOption[]>(this.id, this.temporary, 'options');
  }
  get current(): VariableOption {
    return getVariablePropFromState<VariableOption>(this.id, this.temporary, 'current');
  }
  get refresh(): VariableRefresh {
    return getVariablePropFromState<VariableRefresh>(this.id, this.temporary, 'refresh');
  }
  get multi(): boolean {
    return getVariablePropFromState<boolean>(this.id, this.temporary, 'multi');
  }
  get includeAll(): boolean {
    return getVariablePropFromState<boolean>(this.id, this.temporary, 'includeAll');
  }
  get useTags(): boolean {
    return getVariablePropFromState<boolean>(this.id, this.temporary, 'useTags');
  }
  get tagsQuery(): string {
    return getVariablePropFromState<string>(this.id, this.temporary, 'tagsQuery');
  }
  get tagValuesQuery(): string {
    return getVariablePropFromState<string>(this.id, this.temporary, 'tagValuesQuery');
  }
  get tags(): VariableTag[] {
    return getVariablePropFromState<VariableTag[]>(this.id, this.temporary, 'tags');
  }
  get definition(): string {
    return getVariablePropFromState<string>(this.id, this.temporary, 'definition');
  }
  get allValue(): string {
    return getVariablePropFromState<string>(this.id, this.temporary, 'allValue');
  }

  set type(type) {
    setVariablePropInState(this.id, this.temporary, 'type', type);
  }
  set name(name) {
    setVariablePropInState(this.id, this.temporary, 'name', name);
  }
  set label(label) {
    setVariablePropInState(this.id, this.temporary, 'label', label);
  }
  set hide(hide) {
    setVariablePropInState(this.id, this.temporary, 'hide', hide);
  }
  set skipUrlSync(skipUrlSync) {
    setVariablePropInState(this.id, this.temporary, 'skipUrlSync', skipUrlSync);
  }
  set datasource(datasource) {
    setVariablePropInState(this.id, this.temporary, 'datasource', datasource);
  }
  set query(query) {
    setVariablePropInState(this.id, this.temporary, 'query', query);
  }
  set regex(regex) {
    setVariablePropInState(this.id, this.temporary, 'regex', regex);
  }
  set sort(sort) {
    setVariablePropInState(this.id, this.temporary, 'sort', sort);
  }
  set options(options) {
    setVariablePropInState(this.id, this.temporary, 'options', options);
  }
  set current(current) {
    setVariablePropInState(this.id, this.temporary, 'current', current);
  }
  set refresh(refresh) {
    setVariablePropInState(this.id, this.temporary, 'refresh', refresh);
  }
  set multi(multi) {
    setVariablePropInState(this.id, this.temporary, 'multi', multi);
  }
  set includeAll(includeAll) {
    setVariablePropInState(this.id, this.temporary, 'includeAll', includeAll);
  }
  set useTags(useTags) {
    setVariablePropInState(this.id, this.temporary, 'useTags', useTags);
  }
  set tagsQuery(tagsQuery) {
    setVariablePropInState(this.id, this.temporary, 'tagsQuery', tagsQuery);
  }
  set tagValuesQuery(tagValuesQuery) {
    setVariablePropInState(this.id, this.temporary, 'tagValuesQuery', tagValuesQuery);
  }
  set tags(tags) {
    setVariablePropInState(this.id, this.temporary, 'tags', tags);
  }
  set definition(definition) {
    setVariablePropInState(this.id, this.temporary, 'definition', definition);
  }
  set allValue(allValue) {
    setVariablePropInState(this.id, this.temporary, 'allValue', allValue);
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
      .get(this.datasource)
      .then(ds => this.updateOptionsFromMetricFindQuery(ds, searchFilter))
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
    return this.datasourceSrv.get(this.datasource).then(datasource => {
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
