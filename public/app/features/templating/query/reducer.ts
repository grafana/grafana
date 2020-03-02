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
  VariableWithOptions,
} from '../variable';
import {
  addVariable,
  changeVariableProp,
  hideVariableDropDown,
  removeInitLock,
  resolveInitLock,
  setCurrentVariableValue,
  showVariableDropDown,
  toggleAllVariableOptions,
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
import { changeQueryVariableHighlightIndex, changeQueryVariableSearchQuery, toggleVariableTag } from './actions';
import { ComponentType } from 'react';
import { VariableQueryProps } from '../../../types';
import { initialTemplatingState, TemplatingState } from '../state/reducers';
import cloneDeep from 'lodash/cloneDeep';
import { applyStateChanges } from '../state/applyStateChanges';

export interface QueryVariablePickerState {
  showDropDown: boolean;
  selectedValues: VariableOption[];
  selectedTags: VariableTag[];
  searchQuery: string | null;
  highlightIndex: number;
  tags: VariableTag[];
  options: VariableOption[];
  oldVariableText: string | string[] | null;
}

export interface QueryVariableEditorState {
  VariableQueryEditor: ComponentType<VariableQueryProps> | null;
  dataSources: DataSourceSelectItem[];
  dataSource: DataSourceApi | null;
}

export interface QueryVariableState extends VariableState<QueryVariablePickerState, QueryVariableModel> {}

export const initialQueryVariablePickerState: QueryVariablePickerState = {
  highlightIndex: -1,
  searchQuery: null,
  selectedTags: [],
  selectedValues: [],
  showDropDown: false,
  tags: [],
  options: [],
  oldVariableText: null,
};

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
  picker: initialQueryVariablePickerState,
  variable: initialQueryVariableModelState,
};

export const getQueryHasSearchFilter = (variable: QueryVariableModel) => containsSearchFilter(variable.query);

const hideOtherDropDowns = (state: TemplatingState) => {
  // hack that closes drop downs that already are opened
  // could be solved by moving picker state to
  // 1. A separate picker state slice under templating in Redux
  //  PROS:
  //    - smaller state tree
  //    - no need for this hack since there's only one picker state
  //  CONS:
  //    - state for a variable is no longer in one place but spread out under variables.variable and templating[type].picker templating[type].editor
  //    - picker state will also need addressing like type and uuid to filter out picker state
  // 2. Use local React state instead
  //  PROS:
  //    - no state tree
  //    - no need for this hack
  //  CONS:
  //    - lot's of code and logic that has to move into component
  //    - harder to test component, easier to test reducer
  const openedDropDowns = Object.values(state.variables).filter(s => {
    if (s.variable.type === 'query') {
      return (s.picker as QueryVariablePickerState).showDropDown;
    }
    return false;
  });
  openedDropDowns.map(state => {
    state.picker = initialQueryVariablePickerState;
    return state;
  });
};

export const getLinkText = (variable: VariableWithOptions) => {
  const { current, options } = variable;

  if (!current.tags || current.tags.length === 0) {
    return current.text;
  }

  // filer out values that are in selected tags
  const selectedAndNotInTag = options.filter(option => {
    if (!option.selected) {
      return false;
    }

    if (!current || !current.tags || !current.tags.length) {
      return false;
    }

    for (let i = 0; i < current.tags.length; i++) {
      const tag = current.tags[i];
      const foundIndex = tag?.values?.findIndex(v => v === option.value);
      if (foundIndex && foundIndex !== -1) {
        return false;
      }
    }
    return true;
  });

  // convert values to text
  const currentTexts = selectedAndNotInTag.map(s => s.text);

  // join texts
  const newLinkText = currentTexts.join(' + ');
  return newLinkText.length > 0 ? `${newLinkText} + ` : newLinkText;
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

const updateSelectedValues = (state: QueryVariableState): QueryVariableState => {
  state.picker.selectedValues = state.variable.options.filter(o => o.selected);
  return state;
};

const updateOptions = (state: QueryVariableState): QueryVariableState => {
  state.picker.options = state.variable.options.slice(0, Math.min(state.variable.options.length, 1000));
  return state;
};

const updateCurrent = (state: QueryVariableState): QueryVariableState => {
  const { options, searchQuery, selectedValues, selectedTags } = state.picker;

  state.variable.current.value = selectedValues.map(v => v.value) as string[];
  state.variable.current.text = selectedValues.map(v => v.text).join(' + ');
  state.variable.current.tags = selectedTags;

  if (!state.variable.multi) {
    state.variable.current.value = selectedValues[0].value;
  }

  // if we have a search query and no options use that
  if (options.length === 0 && searchQuery && searchQuery.length > 0) {
    state.variable.current = { text: searchQuery, value: searchQuery, selected: false };
  }

  return state;
};

const updateOldVariableText = (state: QueryVariableState): QueryVariableState => {
  state.picker.oldVariableText = state.variable.current.text;
  return state;
};

const updateTags = (state: QueryVariableState): QueryVariableState => {
  state.picker.tags = state.variable.tags;
  return state;
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

      applyStateChanges(instanceState, updateOptions, updateSelectedValues, updateOldVariableText);
    })
    .addCase(resolveInitLock, (state, action) => {
      const instanceState = getInstanceState<QueryVariableState>(state, action.payload.uuid!);
      instanceState.variable.initLock?.resolve();
    })
    .addCase(removeInitLock, (state, action) => {
      const instanceState = getInstanceState<QueryVariableState>(state, action.payload.uuid!);
      instanceState.variable.initLock = null;
    })
    .addCase(showVariableDropDown, (state, action) => {
      hideOtherDropDowns(state);
      const instanceState = getInstanceState<QueryVariableState>(state, action.payload.uuid!);
      const oldVariableText = instanceState.picker.oldVariableText || instanceState.variable.current.text;
      const highlightIndex = -1;
      const showDropDown = true;
      const queryHasSearchFilter = getQueryHasSearchFilter(instanceState.variable);
      // new behaviour, if this is a query that uses searchfilter it might be a nicer
      // user experience to show the last typed search query in the input field
      const searchQuery =
        queryHasSearchFilter && instanceState.picker.searchQuery ? instanceState.picker.searchQuery : '';

      instanceState.picker.oldVariableText = oldVariableText;
      instanceState.picker.highlightIndex = highlightIndex;
      instanceState.picker.searchQuery = searchQuery;
      instanceState.picker.showDropDown = showDropDown;

      applyStateChanges(instanceState, updateOptions, updateSelectedValues, updateTags);
    })
    .addCase(hideVariableDropDown, (state, action) => {
      const instanceState = getInstanceState<QueryVariableState>(state, action.payload.uuid!);
      instanceState.picker.showDropDown = false;

      applyStateChanges(instanceState, updateOptions, updateSelectedValues);
    })
    .addCase(changeVariableProp, (state, action) => {
      const instanceState = getInstanceState<QueryVariableState>(state, action.payload.uuid!);
      (instanceState.variable as Record<string, any>)[action.payload.data.propName] = action.payload.data.propValue;
    })
    .addCase(toggleVariableTag, (state, action) => {
      const instanceState = getInstanceState<QueryVariableState>(state, action.payload.uuid!);
      const tag = action.payload.data;
      const values = tag.values || [];
      const selected = !tag.selected;

      instanceState.variable.tags = instanceState.variable.tags.map(t => {
        if (t.text !== tag.text) {
          return t;
        }
        t.selected = selected;
        t.valuesText = values.join(' + ');
        t.values = values;
        return t;
      });

      instanceState.variable.options = instanceState.variable.options.map(option => {
        if (values.indexOf(option.value) === -1) {
          return option;
        }

        option.selected = selected;
        return option;
      });

      applyStateChanges(instanceState, updateTags, updateOptions);
    })
    .addCase(changeQueryVariableHighlightIndex, (state, action) => {
      const instanceState = getInstanceState<QueryVariableState>(state, action.payload.uuid!);
      let nextIndex = instanceState.picker.highlightIndex + action.payload.data;

      if (nextIndex < 0) {
        nextIndex = 0;
      } else if (nextIndex >= instanceState.picker.options.length) {
        nextIndex = instanceState.picker.options.length - 1;
      }

      instanceState.picker.highlightIndex = nextIndex;
    })
    .addCase(toggleAllVariableOptions, (state, action) => {
      const instanceState = getInstanceState<QueryVariableState>(state, action.payload.uuid!);
      const { options } = instanceState.variable;
      const selected = !options.find(option => option.selected);

      instanceState.variable.options = options.map(option => ({
        ...option,
        selected,
      }));

      applyStateChanges(instanceState, updateOptions, updateSelectedValues, updateCurrent);
    })
    .addCase(changeQueryVariableSearchQuery, (state, action) => {
      const instanceState = getInstanceState<QueryVariableState>(state, action.payload.uuid!);
      instanceState.picker.searchQuery = action.payload.data;
      instanceState.picker.highlightIndex = 0;
      instanceState.picker.options = instanceState.variable.options.slice(
        0,
        Math.min(instanceState.variable.options.length, 1000)
      );

      if (!getQueryHasSearchFilter(instanceState.variable)) {
        instanceState.picker.options = instanceState.picker.options.filter(option => {
          const text = Array.isArray(option.text) ? option.text.toString() : option.text;
          return text.toLowerCase().indexOf(action.payload.data.toLowerCase()) !== -1;
        });
      }

      applyStateChanges(instanceState, updateSelectedValues, updateCurrent);
    })
);
