import debounce from 'lodash/debounce';
import { StoreState, ThunkDispatch, ThunkResult } from 'app/types';
import { containsSearchFilter, VariableOption, VariableWithMultiSupport, VariableWithOptions } from '../../variable';
import { toVariablePayload, setCurrentVariableValue } from '../../state/actions';
import { variableAdapters } from '../../adapters';
import { getVariable } from '../../state/selectors';
import { NavigationKey } from '../shared/types';
import {
  hideOptions,
  OptionsPickerState,
  updateOptionsFromSearch,
  updateSearchQuery,
  updateOptionsAndFilter,
  toggleOption,
  moveOptionsHighlight,
} from './reducer';

export const navigateOptions = (key: NavigationKey, clearOthers: boolean): ThunkResult<void> => {
  return (dispatch, getState) => {
    if (key === NavigationKey.cancel) {
      return dispatch(commitChangesToVariable());
    }

    if (key === NavigationKey.select) {
      return dispatch(toggleOptionByHighlight(clearOthers));
    }

    if (key === NavigationKey.selectAndClose) {
      dispatch(toggleOptionByHighlight(clearOthers));
      return dispatch(commitChangesToVariable());
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

export const filterOrSearchOptions = (searchQuery: string): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const { uuid } = getState().templating.optionsPicker;
    const { query, options } = getVariable<VariableWithOptions>(uuid, getState());
    dispatch(updateSearchQuery(searchQuery));

    if (containsSearchFilter(query)) {
      return searchForOptionsWithDebounce(dispatch, getState, searchQuery);
    }
    return dispatch(updateOptionsAndFilter(options));
  };
};

export const commitChangesToVariable = (): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const picker = getState().templating.optionsPicker;
    const existing = getVariable<VariableWithMultiSupport>(picker.uuid, getState());
    const current = mapToCurrent(picker);

    dispatch(setCurrentVariableValue(toVariablePayload(existing, current)));
    const updated = getVariable<VariableWithMultiSupport>(picker.uuid, getState());

    if (existing.current.text === updated.current.text) {
      return dispatch(hideOptions());
    }

    const adapter = variableAdapters.get(updated.type);
    await adapter.setValue(updated, updated.current, true);
    return dispatch(hideOptions());
  };
};

export const toggleOptionByHighlight = (clearOthers: boolean): ThunkResult<void> => {
  return (dispatch, getState) => {
    const { uuid, highlightIndex } = getState().templating.optionsPicker;
    const variable = getVariable<VariableWithMultiSupport>(uuid, getState());
    const option = variable.options[highlightIndex];
    dispatch(toggleOption({ option, forceSelect: false, clearOthers }));
  };
};

const searchForOptions = async (dispatch: ThunkDispatch, getState: () => StoreState, searchQuery: string) => {
  try {
    const { uuid } = getState().templating.optionsPicker;
    const existing = getVariable<VariableWithOptions>(uuid, getState());

    const adapter = variableAdapters.get(existing.type);
    await adapter.updateOptions(existing, searchQuery);

    const updated = getVariable<VariableWithOptions>(uuid, getState());
    dispatch(updateOptionsFromSearch(updated.options));
  } catch (error) {
    console.error(error);
  }
};

const searchForOptionsWithDebounce = debounce(searchForOptions, 500);

function mapToCurrent(picker: OptionsPickerState): VariableOption {
  const { options, searchQuery, multi } = picker;

  if (options.length === 0 && searchQuery && searchQuery.length > 0) {
    return { text: searchQuery, value: searchQuery, selected: false };
  }

  if (!multi) {
    return options.find(o => o.selected);
  }

  const texts: string[] = [];
  const values: string[] = [];

  for (const option of options) {
    if (!option.selected) {
      continue;
    }

    texts.push(option.text.toString());
    values.push(option.value.toString());
  }

  return {
    value: values,
    text: texts.join(' + '),
    tags: picker.tags.filter(t => t.selected),
    selected: true,
  };
}
