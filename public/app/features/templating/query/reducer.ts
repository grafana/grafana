import { createReducer } from '@reduxjs/toolkit';
import _ from 'lodash';
import { DataSourceApi, DataSourceSelectItem, stringToJsRegex } from '@grafana/data';

import {
  containsSearchFilter,
  QueryVariableModel,
  VariableHide,
  VariableOption,
  VariableRefresh,
  VariableSort,
  VariableTag,
} from '../variable';
import {
  addVariable,
  changeVariableProp,
  removeInitLock,
  resolveInitLock,
  setCurrentVariableValue,
  updateVariableOptions,
  updateVariableTags,
} from '../state/actions';
import templateSrv from '../template_srv';
import { Deferred } from '../deferred';
import {
  ALL_VARIABLE_TEXT,
  ALL_VARIABLE_VALUE,
  emptyUuid,
  getInstanceState,
  NONE_VARIABLE_TEXT,
  NONE_VARIABLE_VALUE,
  VariableState,
} from '../state/types';
import { ComponentType } from 'react';
import { VariableQueryProps } from '../../../types';
import { initialTemplatingState } from '../state/reducers';
import cloneDeep from 'lodash/cloneDeep';

export interface QueryVariableEditorState {
  VariableQueryEditor: ComponentType<VariableQueryProps> | null;
  dataSources: DataSourceSelectItem[];
  dataSource: DataSourceApi | null;
}

export interface QueryVariableState extends VariableState<QueryVariableModel> {}

export const initialQueryVariableModelState: QueryVariableModel = {
  uuid: emptyUuid,
  global: false,
  index: -1,
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
  initLock: null,
};

export const initialQueryVariableState: QueryVariableState = {
  variable: initialQueryVariableModelState,
};

export const getQueryHasSearchFilter = (variable: QueryVariableModel) => containsSearchFilter(variable.query);

const sortVariableValues = (options: any[], sortOrder: VariableSort) => {
  if (sortOrder === VariableSort.disabled) {
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
};

const metricNamesToVariableValues = (variableRegEx: string, sort: VariableSort, metricNames: any[]) => {
  let regex, i, matches;
  let options: VariableOption[] = [];

  if (variableRegEx) {
    regex = stringToJsRegex(templateSrv.replace(variableRegEx, {}, 'regex'));
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

    options.push({ text: text, value: value, selected: false });
  }

  options = _.uniqBy(options, 'value');
  return sortVariableValues(options, sort);
};

export const queryVariableReducer = createReducer(initialTemplatingState, builder =>
  builder
    .addCase(addVariable, (state, action) => {
      state.variables[action.payload.uuid!] = cloneDeep(initialQueryVariableState);
      state.variables[action.payload.uuid!].variable = {
        ...state.variables[action.payload.uuid!].variable,
        ...action.payload.data.model,
      };
      state.variables[action.payload.uuid!].variable.uuid = action.payload.uuid;
      state.variables[action.payload.uuid!].variable.index = action.payload.data.index;
      state.variables[action.payload.uuid!].variable.global = action.payload.data.global;
      state.variables[action.payload.uuid!].variable.initLock = new Deferred();
    })
    .addCase(updateVariableOptions, (state, action) => {
      const results = action.payload.data;
      const instanceState = getInstanceState<QueryVariableState>(state, action.payload.uuid);
      const { regex, includeAll, sort } = instanceState.variable;
      const options = metricNamesToVariableValues(regex, sort, results);

      if (includeAll) {
        options.unshift({ text: ALL_VARIABLE_TEXT, value: ALL_VARIABLE_VALUE, selected: false });
      }
      if (!options.length) {
        options.push({ text: NONE_VARIABLE_TEXT, value: NONE_VARIABLE_VALUE, isNone: true, selected: false });
      }

      instanceState.variable.options = options;
    })
    .addCase(updateVariableTags, (state, action) => {
      const instanceState = getInstanceState<QueryVariableState>(state, action.payload.uuid);
      const results = action.payload.data;
      const tags: VariableTag[] = [];
      for (let i = 0; i < results.length; i++) {
        tags.push({ text: results[i].text, selected: false });
      }

      instanceState.variable.tags = tags;
    })
    .addCase(setCurrentVariableValue, (state, action) => {
      const instanceState = getInstanceState<QueryVariableState>(state, action.payload.uuid);
      const current = { ...action.payload.data };

      if (Array.isArray(current.text) && current.text.length > 0) {
        current.text = current.text.join(' + ');
      } else if (Array.isArray(current.value) && current.value[0] !== ALL_VARIABLE_VALUE) {
        current.text = current.value.join(' + ');
      }

      instanceState.variable.current = current;
      instanceState.variable.options = instanceState.variable.options.map(option => {
        let selected = false;
        if (Array.isArray(current.value)) {
          for (let index = 0; index < current.value.length; index++) {
            const value = current.value[index];
            if (option.value === value) {
              selected = true;
              break;
            }
          }
        } else if (option.value === current.value) {
          selected = true;
        }
        option.selected = selected;
        return option;
      });
    })
    .addCase(resolveInitLock, (state, action) => {
      const instanceState = getInstanceState<QueryVariableState>(state, action.payload.uuid!);
      instanceState.variable.initLock?.resolve();
    })
    .addCase(removeInitLock, (state, action) => {
      const instanceState = getInstanceState<QueryVariableState>(state, action.payload.uuid!);
      instanceState.variable.initLock = null;
    })
    .addCase(changeVariableProp, (state, action) => {
      const instanceState = getInstanceState<QueryVariableState>(state, action.payload.uuid!);
      (instanceState.variable as Record<string, any>)[action.payload.data.propName] = action.payload.data.propValue;
    })
);
