import { debounce, trim } from 'lodash';
import { StoreState, ThunkDispatch, ThunkResult } from 'app/types';
import { VariableOption, VariableWithMultiSupport, VariableWithOptions } from '../../types';
import { variableAdapters } from '../../adapters';
import { getVariable } from '../../state/selectors';
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
import { toVariablePayload, VariableIdentifier } from '../../state/types';
import { containsSearchFilter, getCurrentText } from '../../utils';

export const navigateOptions = (key: NavigationKey, clearOthers: boolean): ThunkResult<void> => {
  return async (dispatch, getState) => {
    if (key === NavigationKey.cancel) {
      return await dispatch(commitChangesToVariable());
    }

    if (key === NavigationKey.select) {
      return dispatch(toggleOptionByHighlight(clearOthers));
    }

    if (key === NavigationKey.selectAndClose) {
      dispatch(toggleOptionByHighlight(clearOthers, true));
      return await dispatch(commitChangesToVariable());
    }

    if (key === NavigationKey.moveDown) {
      return dispatch(moveOptionsHighlight(1));
    }

    if (key === NavigationKey.moveUp) {
      return dispatch(moveOptionsHighlight(-1));
    }

    return undefined;
  };
};

export const filterOrSearchOptions = (searchQuery = ''): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const { id, queryValue } = getState().templating.optionsPicker;
    const { query, options } = getVariable<VariableWithOptions>(id, getState());
    dispatch(updateSearchQuery(searchQuery));

    if (trim(queryValue) === trim(searchQuery)) {
      return;
    }

    if (containsSearchFilter(query)) {
      return searchForOptionsWithDebounce(dispatch, getState, searchQuery);
    }
    return dispatch(updateOptionsAndFilter(options));
  };
};

const setVariable = async (updated: VariableWithMultiSupport) => {
  const adapter = variableAdapters.get(updated.type);
  await adapter.setValue(updated, updated.current, true);
  return;
};

export const commitChangesToVariable = (callback?: (updated: any) => void): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const picker = getState().templating.optionsPicker;
    const existing = getVariable<VariableWithMultiSupport>(picker.id, getState());
    const currentPayload = { option: mapToCurrent(picker) };
    const searchQueryPayload = { propName: 'queryValue', propValue: picker.queryValue };

    dispatch(setCurrentVariableValue(toVariablePayload(existing, currentPayload)));
    dispatch(changeVariableProp(toVariablePayload(existing, searchQueryPayload)));
    const updated = getVariable<VariableWithMultiSupport>(picker.id, getState());
    dispatch(hideOptions());

    if (getCurrentText(existing) === getCurrentText(updated)) {
      return;
    }

    if (callback) {
      return callback(updated);
    }

    return await setVariable(updated);
  };
};

export const openOptions = ({ id }: VariableIdentifier, callback?: (updated: any) => void): ThunkResult<void> => async (
  dispatch,
  getState
) => {
  const picker = getState().templating.optionsPicker;

  if (picker.id && picker.id !== id) {
    await dispatch(commitChangesToVariable(callback));
  }

  const variable = getVariable<VariableWithMultiSupport>(id, getState());
  dispatch(showOptions(variable));
};

export const toggleOptionByHighlight = (clearOthers: boolean, forceSelect = false): ThunkResult<void> => {
  return (dispatch, getState) => {
    const { highlightIndex, options } = getState().templating.optionsPicker;
    const option = options[highlightIndex];
    dispatch(toggleOption({ option, forceSelect, clearOthers }));
  };
};

const searchForOptions = async (dispatch: ThunkDispatch, getState: () => StoreState, searchQuery: string) => {
  try {
    const { id } = getState().templating.optionsPicker;
    const existing = getVariable<VariableWithOptions>(id, getState());

    const adapter = variableAdapters.get(existing.type);
    await adapter.updateOptions(existing, searchQuery);

    const updated = getVariable<VariableWithOptions>(id, getState());
    dispatch(updateOptionsFromSearch(updated.options));
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
