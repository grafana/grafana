import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { cloneDeep, isString, trimStart } from 'lodash';

import { applyStateChanges } from '../../../../core/utils/applyStateChanges';
import { ALL_VARIABLE_VALUE } from '../../constants';
import { isMulti, isQuery } from '../../guard';
import { VariableOption, VariableWithOptions } from '../../types';
import { containsSearchFilter } from '../../utils';

export interface ToggleOption {
  option?: VariableOption;
  forceSelect: boolean;
  clearOthers: boolean;
}

export interface OptionsPickerState {
  id: string;
  selectedValues: VariableOption[];
  queryValue: string;
  highlightIndex: number;
  options: VariableOption[];
  multi: boolean;
}

export const initialOptionPickerState: OptionsPickerState = {
  id: '',
  highlightIndex: -1,
  queryValue: '',
  selectedValues: [],
  options: [],
  multi: false,
};

export const OPTIONS_LIMIT = 1000;

const optionsToRecord = (options: VariableOption[]): Record<string, VariableOption> => {
  if (!Array.isArray(options)) {
    return {};
  }

  return options.reduce((all: Record<string, VariableOption>, option) => {
    if (isString(option.value)) {
      all[option.value] = option;
    }
    return all;
  }, {});
};

const updateOptions = (state: OptionsPickerState): OptionsPickerState => {
  if (!Array.isArray(state.options)) {
    state.options = [];
    return state;
  }

  const selectedOptions = optionsToRecord(state.selectedValues);
  state.selectedValues = Object.values(selectedOptions);

  state.options = state.options.map((option) => {
    if (!isString(option.value)) {
      return option;
    }

    const selected = !!selectedOptions[option.value];

    if (option.selected === selected) {
      return option;
    }

    return { ...option, selected };
  });
  state.options = applyLimit(state.options);
  return state;
};

const applyLimit = (options: VariableOption[]): VariableOption[] => {
  if (!Array.isArray(options)) {
    return [];
  }
  if (options.length <= OPTIONS_LIMIT) {
    return options;
  }
  return options.slice(0, OPTIONS_LIMIT);
};

const updateDefaultSelection = (state: OptionsPickerState): OptionsPickerState => {
  const { options, selectedValues } = state;

  if (options.length === 0 || selectedValues.length > 0) {
    return state;
  }

  if (!options[0] || options[0].value !== ALL_VARIABLE_VALUE) {
    return state;
  }

  state.selectedValues = [{ ...options[0], selected: true }];
  return state;
};

const updateAllSelection = (state: OptionsPickerState): OptionsPickerState => {
  const { selectedValues } = state;
  if (selectedValues.length > 1) {
    state.selectedValues = selectedValues.filter((option) => option.value !== ALL_VARIABLE_VALUE);
  }
  return state;
};

const optionsPickerSlice = createSlice({
  name: 'templating/optionsPicker',
  initialState: initialOptionPickerState,
  reducers: {
    showOptions: (state, action: PayloadAction<VariableWithOptions>): OptionsPickerState => {
      const { query, options } = action.payload;

      state.highlightIndex = -1;
      state.options = cloneDeep(options);
      state.id = action.payload.id;
      state.queryValue = '';
      state.multi = false;

      if (isMulti(action.payload)) {
        state.multi = action.payload.multi ?? false;
      }

      if (isQuery(action.payload)) {
        const { queryValue } = action.payload;
        const queryHasSearchFilter = containsSearchFilter(query);
        state.queryValue = queryHasSearchFilter && queryValue ? queryValue : '';
      }

      state.selectedValues = state.options.filter((option) => option.selected);
      return applyStateChanges(state, updateDefaultSelection, updateOptions);
    },
    hideOptions: (state, action: PayloadAction): OptionsPickerState => {
      return { ...initialOptionPickerState };
    },
    toggleOption: (state, action: PayloadAction<ToggleOption>): OptionsPickerState => {
      const { option, clearOthers, forceSelect } = action.payload;
      const { multi, selectedValues } = state;

      if (option) {
        const selected = !selectedValues.find((o) => o.value === option.value && o.text === option.text);

        if (option.value === ALL_VARIABLE_VALUE || !multi || clearOthers) {
          if (selected || forceSelect) {
            state.selectedValues = [{ ...option, selected: true }];
          } else {
            state.selectedValues = [];
          }

          return applyStateChanges(state, updateDefaultSelection, updateAllSelection, updateOptions);
        }

        if (forceSelect || selected) {
          state.selectedValues.push({ ...option, selected: true });
          return applyStateChanges(state, updateDefaultSelection, updateAllSelection, updateOptions);
        }

        state.selectedValues = selectedValues.filter((o) => o.value !== option.value && o.text !== option.text);
      } else {
        state.selectedValues = [];
      }

      return applyStateChanges(state, updateDefaultSelection, updateAllSelection, updateOptions);
    },
    moveOptionsHighlight: (state, action: PayloadAction<number>): OptionsPickerState => {
      let nextIndex = state.highlightIndex + action.payload;

      if (nextIndex < 0) {
        nextIndex = -1;
      } else if (nextIndex >= state.options.length) {
        nextIndex = state.options.length - 1;
      }

      return {
        ...state,
        highlightIndex: nextIndex,
      };
    },
    toggleAllOptions: (state, action: PayloadAction): OptionsPickerState => {
      if (state.selectedValues.length > 0) {
        state.selectedValues = [];
        return applyStateChanges(state, updateOptions);
      }

      state.selectedValues = state.options
        .filter((option) => option.value !== ALL_VARIABLE_VALUE)
        .map((option) => ({
          ...option,
          selected: true,
        }));

      return applyStateChanges(state, updateOptions);
    },
    updateSearchQuery: (state, action: PayloadAction<string>): OptionsPickerState => {
      state.queryValue = action.payload;
      return state;
    },
    updateOptionsAndFilter: (state, action: PayloadAction<VariableOption[]>): OptionsPickerState => {
      const searchQuery = trimStart((state.queryValue ?? '').toLowerCase());

      state.options = action.payload.filter((option) => {
        const optionsText = option.text ?? '';
        const text = Array.isArray(optionsText) ? optionsText.toString() : optionsText;
        return text.toLowerCase().indexOf(searchQuery) !== -1;
      });

      state.highlightIndex = 0;

      return applyStateChanges(state, updateDefaultSelection, updateOptions);
    },
    updateOptionsFromSearch: (state, action: PayloadAction<VariableOption[]>): OptionsPickerState => {
      state.options = action.payload;
      state.highlightIndex = 0;

      return applyStateChanges(state, updateDefaultSelection, updateOptions);
    },
    cleanPickerState: () => initialOptionPickerState,
  },
});

export const {
  toggleOption,
  showOptions,
  hideOptions,
  moveOptionsHighlight,
  toggleAllOptions,
  updateSearchQuery,
  updateOptionsAndFilter,
  updateOptionsFromSearch,
  cleanPickerState,
} = optionsPickerSlice.actions;

export const optionsPickerReducer = optionsPickerSlice.reducer;
