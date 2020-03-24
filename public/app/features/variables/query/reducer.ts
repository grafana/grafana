import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import _ from 'lodash';
import { DataSourceApi, DataSourceSelectItem, stringToJsRegex } from '@grafana/data';

import {
  QueryVariableModel,
  VariableHide,
  VariableOption,
  VariableRefresh,
  VariableSort,
  VariableTag,
} from '../../templating/types';
import templateSrv from '../../templating/template_srv';
import {
  ALL_VARIABLE_TEXT,
  ALL_VARIABLE_VALUE,
  getInstanceState,
  NEW_VARIABLE_ID,
  NONE_VARIABLE_TEXT,
  NONE_VARIABLE_VALUE,
  VariablePayload,
} from '../state/types';
import { ComponentType } from 'react';
import { VariableQueryProps } from '../../../types';
import { initialVariablesState, VariablesState } from '../state/variablesReducer';

export interface QueryVariableEditorState {
  VariableQueryEditor: ComponentType<VariableQueryProps> | null;
  dataSources: DataSourceSelectItem[];
  dataSource: DataSourceApi | null;
}

export const initialQueryVariableModelState: QueryVariableModel = {
  id: NEW_VARIABLE_ID,
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

export const queryVariableSlice = createSlice({
  name: 'templating/query',
  initialState: initialVariablesState,
  reducers: {
    updateVariableOptions: (state: VariablesState, action: PayloadAction<VariablePayload<any[]>>) => {
      const results = action.payload.data;
      const instanceState = getInstanceState<QueryVariableModel>(state, action.payload.id);
      const { regex, includeAll, sort } = instanceState;
      const options = metricNamesToVariableValues(regex, sort, results);

      if (includeAll) {
        options.unshift({ text: ALL_VARIABLE_TEXT, value: ALL_VARIABLE_VALUE, selected: false });
      }
      if (!options.length) {
        options.push({ text: NONE_VARIABLE_TEXT, value: NONE_VARIABLE_VALUE, isNone: true, selected: false });
      }

      instanceState.options = options;
    },
    updateVariableTags: (state: VariablesState, action: PayloadAction<VariablePayload<any[]>>) => {
      const instanceState = getInstanceState<QueryVariableModel>(state, action.payload.id);
      const results = action.payload.data;
      const tags: VariableTag[] = [];
      for (let i = 0; i < results.length; i++) {
        tags.push({ text: results[i].text, selected: false });
      }

      instanceState.tags = tags;
    },
  },
});

export const queryVariableReducer = queryVariableSlice.reducer;

export const { updateVariableOptions, updateVariableTags } = queryVariableSlice.actions;
