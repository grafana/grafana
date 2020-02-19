import {
  containsVariable,
  QueryVariableModel,
  VariableRefresh,
  VariableOption,
  VariableActions,
  VariableSort,
  VariableTag,
  VariableType,
  VariableHide,
} from '../variable';
import { ALL_VARIABLE_TEXT } from '../state/queryVariableReducer';
import { dispatch } from '../../../store/store';
import { setOptionAsCurrent, setOptionFromUrl } from '../state/actions';
import { updateQueryVariableOptions } from '../state/queryVariableActions';
import { Deferred } from '../deferred';

export class QueryVariableAdapter implements QueryVariableModel, VariableActions {
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
  initLock?: Deferred | null;

  uuid?: string; // only exists for variables in redux state
  global?: boolean; // only exists for variables in redux state

  constructor(model: QueryVariableModel) {
    this.type = 'query';
    this.name = model.name;
    this.label = model.label;
    this.hide = model.hide;
    this.skipUrlSync = model.skipUrlSync;
    this.datasource = model.datasource;
    this.query = model.query;
    this.regex = model.regex;
    this.sort = model.sort;
    this.options = model.options;
    this.current = model.current;
    this.refresh = model.refresh;
    this.multi = model.multi;
    this.includeAll = model.includeAll;
    this.useTags = model.useTags;
    this.tagsQuery = model.tagsQuery;
    this.tags = model.tags;
    this.definition = model.definition;
    this.allValue = model.allValue;
    this.index = model.index;
    this.initLock = model.initLock;
    this.uuid = model.uuid;
    this.global = model.global;
  }

  dependsOn(variable: QueryVariableModel) {
    const { query, datasource, regex } = this;
    return containsVariable(query, datasource, regex, variable.name);
  }

  async setValue(option: VariableOption) {
    await dispatch(setOptionAsCurrent(this, option));
  }

  async setValueFromUrl(urlValue: string) {
    await dispatch(setOptionFromUrl(this, urlValue));
  }

  async updateOptions(searchFilter?: string) {
    await dispatch(updateQueryVariableOptions(this, searchFilter));
  }

  getSaveModel() {
    const { index, uuid, initLock, global, ...rest } = this;
    // remove options
    if (this.refresh !== VariableRefresh.never) {
      return { ...rest, options: [] };
    }

    return rest;
  }

  getValueForUrl() {
    if (this.current.text === ALL_VARIABLE_TEXT) {
      return ALL_VARIABLE_TEXT;
    }
    return this.current.value;
  }
}
