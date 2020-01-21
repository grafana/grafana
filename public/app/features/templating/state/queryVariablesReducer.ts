import { AnyAction } from '@reduxjs/toolkit';

import {
  QueryVariableModel,
  VariableHide,
  VariableOption,
  VariableRefresh,
  VariableSort,
  VariableTag,
} from '../variable';
import {
  addVariable,
  removeInitLock,
  resolveInitLock,
  selectVariableOption,
  setCurrentVariableValue,
  setInitLock,
  updateVariableOptions,
  updateVariableTags,
} from './actions';
import _ from 'lodash';
import { stringToJsRegex } from '@grafana/data';
import templateSrv from '../template_srv';
import { Deferred } from '../deferred';

export interface QueryVariableState extends QueryVariableModel {}

export const initialQueryVariableState: QueryVariableState = {
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

// I stumbled upon the error described here https://github.com/immerjs/immer/issues/430
// So reverting to a "normal" reducer
export const queryVariableReducer = (
  state: QueryVariableState = initialQueryVariableState,
  action: AnyAction
): QueryVariableState => {
  if (addVariable.match(action)) {
    const {
      type,
      name,
      label,
      hide,
      skipUrlSync,
      datasource,
      query,
      regex,
      sort,
      refresh,
      multi,
      includeAll,
      allValue,
      options,
      current,
      tags,
      useTags,
      tagsQuery,
      tagValuesQuery,
      definition,
    } = action.payload.model as QueryVariableModel;
    return {
      ...state,
      global: action.payload.global,
      index: action.payload.index,
      type,
      name,
      label,
      hide,
      skipUrlSync,
      datasource,
      query,
      regex,
      sort,
      refresh,
      multi,
      includeAll,
      allValue,
      options,
      current,
      tags,
      useTags,
      tagsQuery,
      tagValuesQuery,
      definition,
    };
  }

  if (updateVariableOptions.match(action)) {
    const results = action.payload.results;
    const { regex, includeAll, sort } = state;
    const options = metricNamesToVariableValues(regex, sort, results);
    if (includeAll) {
      options.unshift({ text: 'All', value: '$__all', selected: false });
    }
    if (!options.length) {
      options.push({ text: 'None', value: '', isNone: true, selected: false });
    }

    return { ...state, options };
  }

  if (updateVariableTags.match(action)) {
    const results = action.payload.results;
    const tags: VariableTag[] = [];
    for (let i = 0; i < results.length; i++) {
      tags.push({ text: results[i].text, selected: false });
    }

    return { ...state, tags };
  }

  if (setCurrentVariableValue.match(action)) {
    const current = action.payload.current;

    if (Array.isArray(current.text) && current.text.length > 0) {
      current.text = current.text.join(' + ');
    } else if (Array.isArray(current.value) && current.value[0] !== '$__all') {
      current.text = current.value.join(' + ');
    }

    return {
      ...state,
      current,
      options: state.options.map(option => {
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
        return {
          ...option,
          selected,
        };
      }),
    };
  }

  if (setInitLock.match(action)) {
    return { ...state, initLock: new Deferred() };
  }

  if (resolveInitLock.match(action)) {
    state.initLock.resolve();
    return { ...state };
  }

  if (removeInitLock.match(action)) {
    return { ...state, initLock: null };
  }

  if (selectVariableOption.match(action)) {
    const { option, forceSelect, event } = action.payload;
    const { multi } = state;
    return {
      ...state,
      options: state.options.map(o => {
        if (o.value !== option.value) {
          let selected = o.selected;
          if (o.text === 'All' || option.text === 'All') {
            selected = false;
          } else if (!multi) {
            selected = false;
          } else if (event.ctrlKey || event.metaKey || event.shiftKey) {
            selected = false;
          }
          return {
            ...o,
            selected,
          };
        }
        const selected = forceSelect ? true : multi ? !option.selected : true;
        return {
          ...o,
          selected,
        };
      }),
    };
  }

  return state;
};

export const initialQueryVariablesState: QueryVariableState[] = [];

export const updateChildState = (
  state: QueryVariableState[],
  type: string,
  name: string,
  action: AnyAction
): QueryVariableState[] => {
  if (type !== 'query') {
    return state;
  }

  const instanceIndex = state.findIndex(variable => variable.name === name);
  const instanceState = state[instanceIndex];
  return state.map((v, index) => {
    if (index !== instanceIndex) {
      return v;
    }

    return {
      ...v,
      ...queryVariableReducer(instanceState, action),
    };
  });
};

export const queryVariablesReducer = (
  state: QueryVariableState[] = initialQueryVariablesState,
  action: AnyAction
): QueryVariableState[] => {
  if (addVariable.match(action)) {
    if (action.payload.model.type !== 'query') {
      return state;
    }

    const variable = queryVariableReducer(undefined, action);
    return [...state, variable];
  }

  if (updateVariableOptions.match(action)) {
    const { type, name } = action.payload.variable;
    return updateChildState(state, type, name, action);
  }

  if (updateVariableTags.match(action)) {
    const { type, name } = action.payload.variable;
    return updateChildState(state, type, name, action);
  }

  if (setCurrentVariableValue.match(action)) {
    const { type, name } = action.payload.variable;
    return updateChildState(state, type, name, action);
  }

  if (setInitLock.match(action)) {
    const { type, name } = action.payload;
    return updateChildState(state, type, name, action);
  }

  if (resolveInitLock.match(action)) {
    const { type, name } = action.payload;
    return updateChildState(state, type, name, action);
  }

  if (removeInitLock.match(action)) {
    const { type, name } = action.payload;
    return updateChildState(state, type, name, action);
  }

  if (selectVariableOption.match(action)) {
    const { type, name } = action.payload.variable;
    return updateChildState(state, type, name, action);
  }

  return state;
};
