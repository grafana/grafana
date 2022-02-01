import { debounce, trim } from 'lodash';
import { StoreState, ThunkDispatch, ThunkResult } from 'app/types';
import { VariableOption, VariableWithMultiSupport, VariableWithOptions } from '../../types';
import { variableAdapters } from '../../adapters';
import { getVariable, getVariablesState } from '../../state/selectors';
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
import { changeVariableProp, setCurrentVariableValue } from '../../state/sharedReducer';
import { KeyedVariableIdentifier } from '../../state/types';
import { containsSearchFilter, getCurrentText, toVariablePayload } from '../../utils';
import { toKeyedAction } from '../../state/keyedVariablesReducer';

export const navigateOptions = (uid: string, key: NavigationKey, clearOthers: boolean): ThunkResult<void> => {
  return async (dispatch, getState) => {
    if (key === NavigationKey.cancel) {
      return await dispatch(commitChangesToVariable(uid));
    }

    if (key === NavigationKey.select) {
      return dispatch(toggleOptionByHighlight(uid, clearOthers));
    }

    if (key === NavigationKey.selectAndClose) {
      dispatch(toggleOptionByHighlight(uid, clearOthers, true));
      return await dispatch(commitChangesToVariable(uid));
    }

    if (key === NavigationKey.moveDown) {
      return dispatch(toKeyedAction(uid, moveOptionsHighlight(1)));
    }

    if (key === NavigationKey.moveUp) {
      return dispatch(toKeyedAction(uid, moveOptionsHighlight(-1)));
    }

    return undefined;
  };
};

export const filterOrSearchOptions = (
  passedIdentifier: KeyedVariableIdentifier,
  searchQuery = ''
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const { stateKey: uid } = passedIdentifier;
    const { id, queryValue } = getVariablesState(uid, getState()).optionsPicker;
    const identifier: KeyedVariableIdentifier = { id, stateKey: uid, type: 'query' };
    const { query, options } = getVariable<VariableWithOptions>(identifier, getState());
    dispatch(toKeyedAction(uid, updateSearchQuery(searchQuery)));

    if (trim(queryValue) === trim(searchQuery)) {
      return;
    }

    if (containsSearchFilter(query)) {
      return searchForOptionsWithDebounce(dispatch, getState, searchQuery, uid);
    }
    return dispatch(toKeyedAction(uid, updateOptionsAndFilter(options)));
  };
};

const setVariable = async (updated: VariableWithMultiSupport) => {
  const adapter = variableAdapters.get(updated.type);
  await adapter.setValue(updated, updated.current, true);
  return;
};

export const commitChangesToVariable = (uid: string, callback?: (updated: any) => void): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const picker = getVariablesState(uid, getState()).optionsPicker;
    const identifier: KeyedVariableIdentifier = { id: picker.id, stateKey: uid, type: 'query' };
    const existing = getVariable<VariableWithMultiSupport>(identifier, getState());
    const currentPayload = { option: mapToCurrent(picker) };
    const searchQueryPayload = { propName: 'queryValue', propValue: picker.queryValue };

    dispatch(toKeyedAction(uid, setCurrentVariableValue(toVariablePayload(existing, currentPayload))));
    dispatch(toKeyedAction(uid, changeVariableProp(toVariablePayload(existing, searchQueryPayload))));
    const updated = getVariable<VariableWithMultiSupport>(identifier, getState());
    dispatch(toKeyedAction(uid, hideOptions()));

    if (getCurrentText(existing) === getCurrentText(updated)) {
      return;
    }

    if (callback) {
      return callback(updated);
    }

    return await setVariable(updated);
  };
};

export const openOptions = (
  identifier: KeyedVariableIdentifier,
  callback?: (updated: any) => void
): ThunkResult<void> => async (dispatch, getState) => {
  const { id, stateKey: uid } = identifier;
  const picker = getVariablesState(uid, getState()).optionsPicker;

  if (picker.id && picker.id !== id) {
    await dispatch(commitChangesToVariable(uid, callback));
  }

  const variable = getVariable<VariableWithMultiSupport>(identifier, getState());
  dispatch(toKeyedAction(uid, showOptions(variable)));
};

export const toggleOptionByHighlight = (uid: string, clearOthers: boolean, forceSelect = false): ThunkResult<void> => {
  return (dispatch, getState) => {
    const { highlightIndex, options } = getVariablesState(uid, getState()).optionsPicker;
    const option = options[highlightIndex];
    dispatch(toKeyedAction(uid, toggleOption({ option, forceSelect, clearOthers })));
  };
};

const searchForOptions = async (
  dispatch: ThunkDispatch,
  getState: () => StoreState,
  searchQuery: string,
  uid: string
) => {
  try {
    const { id } = getVariablesState(uid, getState()).optionsPicker;
    const identifier: KeyedVariableIdentifier = { id, stateKey: uid, type: 'query' };
    const existing = getVariable<VariableWithOptions>(identifier, getState());

    const adapter = variableAdapters.get(existing.type);
    await adapter.updateOptions(existing, searchQuery);

    const updated = getVariable<VariableWithOptions>(identifier, getState());
    dispatch(toKeyedAction(uid, updateOptionsFromSearch(updated.options)));
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
