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
  changeVariableNameFailed,
  changeVariableNameSucceeded,
  changeVariableProp,
  removeInitLock,
  resolveInitLock,
  setCurrentVariableValue,
  setInitLock,
  updateVariableFailed,
  updateVariableOptions,
  updateVariableTags,
} from './actions';
import _ from 'lodash';
import { DataSourceApi, stringToJsRegex } from '@grafana/data';
import templateSrv from '../template_srv';
import { Deferred } from '../deferred';
import { emptyUuid, initialVariableEditorState, VariableEditorState, VariableState } from './types';
import {
  hideQueryVariableDropDown,
  queryVariableDatasourceLoaded,
  queryVariableEditorLoaded,
  selectVariableOption,
  showQueryVariableDropDown,
  toggleVariableTag,
} from './queryVariableActions';
import { ComponentType } from 'react';
import { VariableQueryProps } from '../../../types';

export type MutateStateFunc<S extends VariableState> = (state: S) => S;
export const appyStateChanges = <S extends VariableState>(state: S, ...args: Array<MutateStateFunc<S>>): S => {
  return args.reduce((all, cur) => {
    return cur(all);
  }, state);
};

export interface QueryVariablePickerState {
  showDropDown: boolean;
  linkText: string | string[] | null;
  selectedValues: VariableOption[];
  selectedTags: VariableTag[];
  searchQuery: string | null;
  searchOptions: VariableOption[];
  highlightIndex: number;
  tags: VariableTag[];
  options: VariableOption[];
  queryHasSearchFilter: boolean;
  oldVariableText: string | string[] | null;
}

export interface QueryVariableEditorState extends VariableEditorState {
  VariableQueryEditor: ComponentType<VariableQueryProps> | null;
  dataSource: DataSourceApi | null;
}

export interface QueryVariableState
  extends VariableState<QueryVariablePickerState, QueryVariableEditorState, QueryVariableModel> {}

export const initialQueryVariablePickerState: QueryVariablePickerState = {
  highlightIndex: -1,
  linkText: null,
  queryHasSearchFilter: false,
  searchOptions: [],
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

export const initialQueryVariableEditorState: QueryVariableEditorState = {
  ...initialVariableEditorState,
  VariableQueryEditor: null,
  dataSource: null,
};

export const initialQueryVariableState: QueryVariableState = {
  picker: initialQueryVariablePickerState,
  editor: initialQueryVariableEditorState,
  variable: initialQueryVariableModelState,
};

export const ALL_VARIABLE_TEXT = 'All';
export const ALL_VARIABLE_VALUE = '$__all';
export const NONE_VARIABLE_TEXT = 'None';
export const NONE_VARIABLE_VALUE = '';

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

const updateLinkText = (state: QueryVariableState): QueryVariableState => {
  const { current, options } = state.variable;

  if (!current.tags || current.tags.length === 0) {
    return {
      ...state,
      picker: {
        ...state.picker,
        linkText: current.text,
      },
    };
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
  return {
    ...state,
    picker: {
      ...state.picker,
      linkText: newLinkText.length > 0 ? `${newLinkText} + ` : newLinkText,
    },
  };
};

const updateSelectedValues = (state: QueryVariableState): QueryVariableState => {
  return {
    ...state,
    picker: {
      ...state.picker,
      selectedValues: state.variable.options.filter(o => o.selected),
    },
  };
};

const updateSelectedTags = (state: QueryVariableState): QueryVariableState => {
  return {
    ...state,
    picker: {
      ...state.picker,
      selectedTags: state.variable.tags.filter(t => t.selected),
    },
  };
};

const updateOptions = (state: QueryVariableState): QueryVariableState => {
  return {
    ...state,
    picker: {
      ...state.picker,
      options: state.variable.options.slice(0, Math.min(state.variable.options.length, 1000)),
    },
  };
};

const updateCurrent = (state: QueryVariableState): QueryVariableState => {
  const { searchOptions, searchQuery, selectedValues, selectedTags } = state.picker;
  let current = { ...state.variable.current };

  current.value = selectedValues.map(v => v.value) as string[];
  current.text = selectedValues.map(v => v.text).join(' + ');
  current.tags = selectedTags;

  if (!state.variable.multi) {
    current.value = selectedValues[0].value;
  }

  // if we have a search query and no options use that
  if (searchOptions.length === 0 && searchQuery && searchQuery.length > 0) {
    current = { text: searchQuery, value: searchQuery, selected: false };
  }

  return { ...state, variable: { ...state.variable, current } };
};

const updateOldVariableText = (state: QueryVariableState): QueryVariableState => {
  return {
    ...state,
    picker: {
      ...state.picker,
      oldVariableText: state.variable.current.text,
    },
  };
};

const updateEditorErrors = (state: QueryVariableState): QueryVariableState => {
  let errorText = null;
  if (
    typeof state.variable.query === 'string' &&
    state.variable.query.match(new RegExp('\\$' + state.variable.name + '(/| |$)'))
  ) {
    errorText = 'Query cannot contain a reference to itself. Variable: $' + state.variable.name;
  }

  if (!errorText) {
    delete state.editor.errors.query;
    return state;
  }

  return {
    ...state,
    editor: {
      ...state.editor,
      errors: {
        ...state.editor.errors,
        query: errorText,
      },
    },
  };
};

const updateEditorIsValid = (state: QueryVariableState): QueryVariableState => {
  return {
    ...state,
    editor: {
      ...state.editor,
      isValid: Object.keys(state.editor.errors).length === 0,
    },
  };
};

const updateTags = (state: QueryVariableState): QueryVariableState => {
  const { picker, variable } = state;
  return {
    ...state,
    picker: {
      ...picker,
      tags: [...variable.tags],
    },
  };
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
    } = action.payload.data.model as QueryVariableModel;
    return {
      variable: {
        uuid: action.payload.uuid,
        global: action.payload.data.global,
        index: action.payload.data.index,
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
      },
      picker: initialQueryVariablePickerState,
      editor: initialQueryVariableEditorState,
    };
  }

  if (updateVariableOptions.match(action)) {
    const results = action.payload.data;
    const { regex, includeAll, sort } = state.variable;
    const options = metricNamesToVariableValues(regex, sort, results);
    if (includeAll) {
      options.unshift({ text: ALL_VARIABLE_TEXT, value: ALL_VARIABLE_VALUE, selected: false });
    }
    if (!options.length) {
      options.push({ text: NONE_VARIABLE_TEXT, value: NONE_VARIABLE_VALUE, isNone: true, selected: false });
    }

    return { ...state, variable: { ...state.variable, options } };
  }

  if (updateVariableFailed.match(action)) {
    return { ...state, editor: { ...state.editor, isValid: false, errors: { update: action.payload.data.message } } };
  }

  if (updateVariableTags.match(action)) {
    const results = action.payload.data;
    const tags: VariableTag[] = [];
    for (let i = 0; i < results.length; i++) {
      tags.push({ text: results[i].text, selected: false });
    }

    return { ...state, variable: { ...state.variable, tags } };
  }

  if (setCurrentVariableValue.match(action)) {
    const current = action.payload.data;

    if (Array.isArray(current.text) && current.text.length > 0) {
      current.text = current.text.join(' + ');
    } else if (Array.isArray(current.value) && current.value[0] !== ALL_VARIABLE_VALUE) {
      current.text = current.value.join(' + ');
    }

    const newState = {
      ...state,
      variable: {
        ...state.variable,
        current,
        options: state.variable.options.map(option => {
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
      },
    };

    return appyStateChanges(
      newState,
      updateOptions,
      updateSelectedValues,
      updateSelectedTags,
      updateLinkText,
      updateOldVariableText
    );
  }

  if (setInitLock.match(action)) {
    return { ...state, variable: { ...state.variable, initLock: new Deferred() } };
  }

  if (resolveInitLock.match(action)) {
    // unfortunate side effect in reducer
    state.variable.initLock?.resolve();
    return { ...state };
  }

  if (removeInitLock.match(action)) {
    return { ...state, variable: { ...state.variable, initLock: null } };
  }

  if (selectVariableOption.match(action)) {
    const { option, forceSelect, event } = action.payload.data;
    const { multi } = state.variable;
    const newOptions: VariableOption[] = state.variable.options.map(o => {
      if (o.value !== option.value) {
        let selected = o.selected;
        if (o.text === ALL_VARIABLE_TEXT || option.text === ALL_VARIABLE_TEXT) {
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
    });

    if (newOptions.length > 0 && newOptions.filter(o => o.selected).length === 0) {
      newOptions[0].selected = true;
    }

    const newState = {
      ...state,
      variable: {
        ...state.variable,
        options: newOptions,
      },
    };

    return appyStateChanges(
      newState,
      updateOptions,
      updateSelectedValues,
      updateSelectedTags,
      updateCurrent,
      updateLinkText
    );
  }

  if (showQueryVariableDropDown.match(action)) {
    const oldVariableText = state.picker.oldVariableText || state.variable.current.text;
    const highlightIndex = -1;
    const showDropDown = true;
    // new behaviour, if this is a query that uses searchfilter it might be a nicer
    // user experience to show the last typed search query in the input field
    const searchQuery = state.picker.queryHasSearchFilter && state.picker.searchQuery ? state.picker.searchQuery : '';

    const newState = {
      ...state,
      picker: {
        ...state.picker,
        oldVariableText,
        highlightIndex,
        searchQuery,
        showDropDown,
      },
    };

    return appyStateChanges(
      newState,
      updateOptions,
      updateSelectedValues,
      updateTags,
      updateSelectedTags,
      updateLinkText
    );
  }

  if (hideQueryVariableDropDown.match(action)) {
    const newState = { ...state, picker: { ...state.picker, showDropDown: false } };

    return appyStateChanges(newState, updateOptions, updateSelectedValues, updateSelectedTags, updateLinkText);
  }

  if (changeVariableNameSucceeded.match(action)) {
    delete state.editor.errors['name'];
    return {
      ...state,
      editor: {
        ...state.editor,
        name: action.payload.data,
        isValid: true,
      },
      variable: {
        ...state.variable,
        name: action.payload.data,
      },
    };
  }

  if (changeVariableNameFailed.match(action)) {
    return {
      ...state,
      editor: {
        ...state.editor,
        isValid: false,
        name: action.payload.data.newName,
        errors: {
          ...state.editor.errors,
          name: action.payload.data.errorText,
        },
      },
    };
  }

  if (queryVariableDatasourceLoaded.match(action)) {
    return {
      ...state,
      editor: {
        ...state.editor,
        dataSource: action.payload.data,
      },
    };
  }

  if (queryVariableEditorLoaded.match(action)) {
    return {
      ...state,
      editor: {
        ...state.editor,
        VariableQueryEditor: action.payload.data,
      },
    };
  }

  if (changeVariableProp.match(action)) {
    const newState = {
      ...state,
      variable: {
        ...state.variable,
        [action.payload.data.propName]: action.payload.data.propValue,
      },
    };

    return appyStateChanges(newState, updateEditorErrors, updateEditorIsValid);
  }

  if (toggleVariableTag.match(action)) {
    const tag = action.payload.data;
    const values = tag.values || [];
    const selected = !tag.selected;

    const newState = {
      ...state,
      variable: {
        ...state.variable,
        tags: state.variable.tags.map(current => {
          if (current.text !== tag.text) {
            return { ...current };
          }
          return {
            ...current,
            selected,
            valuesText: values.join(' + '),
            values,
          };
        }),
        options: state.variable.options.map(option => {
          if (values.indexOf(option.value) === -1) {
            return option;
          }

          return {
            ...option,
            selected,
          };
        }),
      },
    };

    return appyStateChanges(newState, updateTags, updateOptions);
  }

  return state;
};
