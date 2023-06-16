import { debounce, trim } from 'lodash';

import { isEmptyObject } from '@grafana/data';
import { StoreState, ThunkDispatch, ThunkResult } from 'app/types';

import { variableAdapters } from '../../adapters';
import { hasOptions } from '../../guard';
import { toKeyedAction } from '../../state/keyedVariablesReducer';
import { getVariable, getVariablesState } from '../../state/selectors';
import { changeVariableProp, setCurrentVariableValue } from '../../state/sharedReducer';
import { KeyedVariableIdentifier } from '../../state/types';
import { VariableOption, VariableWithOptions } from '../../types';
import { containsSearchFilter, getCurrentValue, toVariablePayload } from '../../utils';
import { NavigationKey } from '../types';

import {
  hideOptions,
  moveOptionsHighlight,
  OptionsPickerState,
  showOptions,
  toggleOption,
  updateOptionsAndFilter,
  updateOptionsFromSearch,
  updateSearchQuery,
} from './reducer';

export const navigateOptions = (rootStateKey: string, key: NavigationKey, clearOthers: boolean): ThunkResult<void> => {
  return async (dispatch, getState) => {
    if (key === NavigationKey.cancel) {
      return await dispatch(commitChangesToVariable(rootStateKey));
    }

    if (key === NavigationKey.select) {
      return dispatch(toggleOptionByHighlight(rootStateKey, clearOthers));
    }

    if (key === NavigationKey.selectAndClose) {
      const picker = getVariablesState(rootStateKey, getState()).optionsPicker;

      if (picker.multi) {
        return dispatch(toggleOptionByHighlight(rootStateKey, clearOthers));
      }
      dispatch(toggleOptionByHighlight(rootStateKey, clearOthers, true));
      return dispatch(commitChangesToVariable(rootStateKey));
    }

    if (key === NavigationKey.moveDown) {
      return dispatch(toKeyedAction(rootStateKey, moveOptionsHighlight(1)));
    }

    if (key === NavigationKey.moveUp) {
      return dispatch(toKeyedAction(rootStateKey, moveOptionsHighlight(-1)));
    }

    return undefined;
  };
};

export const filterOrSearchOptions = (
  passedIdentifier: KeyedVariableIdentifier,
  searchQuery = ''
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const { rootStateKey } = passedIdentifier;
    const { id, queryValue } = getVariablesState(rootStateKey, getState()).optionsPicker;
    const identifier: KeyedVariableIdentifier = { id, rootStateKey: rootStateKey, type: 'query' };
    const variable = getVariable(identifier, getState());

    if (!('options' in variable)) {
      return;
    }

    dispatch(toKeyedAction(rootStateKey, updateSearchQuery(searchQuery)));

    if (trim(queryValue) === trim(searchQuery)) {
      return;
    }

    const { query, options } = variable;

    const queryTarget = typeof query === 'string' ? query : query.target;
    if (containsSearchFilter(queryTarget)) {
      return searchForOptionsWithDebounce(dispatch, getState, searchQuery, rootStateKey);
    }

    return dispatch(toKeyedAction(rootStateKey, updateOptionsAndFilter(options)));
  };
};

const setVariable = async (updated: VariableWithOptions) => {
  if (isEmptyObject(updated.current)) {
    return;
  }

  const adapter = variableAdapters.get(updated.type);
  await adapter.setValue(updated, updated.current, true);
  return;
};

export const commitChangesToVariable = (key: string, callback?: (updated: any) => void): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const picker = getVariablesState(key, getState()).optionsPicker;
    const identifier: KeyedVariableIdentifier = { id: picker.id, rootStateKey: key, type: 'query' };
    const existing = getVariable(identifier, getState());
    if (!hasOptions(existing)) {
      return;
    }

    const currentPayload = { option: mapToCurrent(picker) };
    const searchQueryPayload = { propName: 'queryValue', propValue: picker.queryValue };

    dispatch(toKeyedAction(key, setCurrentVariableValue(toVariablePayload(existing, currentPayload))));
    dispatch(toKeyedAction(key, changeVariableProp(toVariablePayload(existing, searchQueryPayload))));

    const updated = getVariable(identifier, getState());
    if (!hasOptions(updated)) {
      return;
    }

    dispatch(toKeyedAction(key, hideOptions()));

    if (getCurrentValue(existing) === getCurrentValue(updated)) {
      return;
    }

    if (callback) {
      return callback(updated);
    }

    return await setVariable(updated);
  };
};

export const openOptions =
  (identifier: KeyedVariableIdentifier, callback?: (updated: any) => void): ThunkResult<void> =>
  async (dispatch, getState) => {
    const { id, rootStateKey: uid } = identifier;
    const picker = getVariablesState(uid, getState()).optionsPicker;

    if (picker.id && picker.id !== id) {
      await dispatch(commitChangesToVariable(uid, callback));
    }

    const variable = getVariable(identifier, getState());
    if (!hasOptions(variable)) {
      return;
    }

    dispatch(toKeyedAction(uid, showOptions(variable)));
  };

export const toggleOptionByHighlight = (key: string, clearOthers: boolean, forceSelect = false): ThunkResult<void> => {
  return (dispatch, getState) => {
    const { highlightIndex, options } = getVariablesState(key, getState()).optionsPicker;
    const option = options[highlightIndex];
    dispatch(toKeyedAction(key, toggleOption({ option, forceSelect, clearOthers })));
  };
};

const searchForOptions = async (
  dispatch: ThunkDispatch,
  getState: () => StoreState,
  searchQuery: string,
  key: string
) => {
  try {
    const { id } = getVariablesState(key, getState()).optionsPicker;
    const identifier: KeyedVariableIdentifier = { id, rootStateKey: key, type: 'query' };
    const existing = getVariable(identifier, getState());
    if (!hasOptions(existing)) {
      return;
    }

    const adapter = variableAdapters.get(existing.type);
    await adapter.updateOptions(existing, searchQuery);

    const updated = getVariable(identifier, getState());
    if (!hasOptions(updated)) {
      return;
    }

    dispatch(toKeyedAction(key, updateOptionsFromSearch(updated.options)));
  } catch (error) {
    console.error(error);
  }
};

const searchForOptionsWithDebounce = debounce(searchForOptions, 500);

export function mapToCurrent(picker: OptionsPickerState): VariableOption | undefined {
  const { options, selectedValues, queryValue: searchQuery, multi } = picker;

  if (options.length === 0 && searchQuery && searchQuery.length > 0) {
    return { text: searchQuery, value: searchQuery, selected: false };
  }

  if (!multi) {
    return selectedValues.find((o) => o.selected);
  }

  const texts: string[] = [];
  const values: string[] = [];

  for (const option of selectedValues) {
    if (!option.selected) {
      continue;
    }

    texts.push(option.text.toString());
    values.push(option.value.toString());
  }

  return {
    value: values,
    text: texts,
    selected: true,
  };
}
