import uFuzzy from '@leeoniya/ufuzzy';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { cloneDeep, isString } from 'lodash';

import { containsSearchFilter, VariableOption, VariableWithOptions } from '@grafana/data';

import { applyStateChanges } from '../../../../core/utils/applyStateChanges';
import { ALL_VARIABLE_VALUE } from '../../constants';
import { isMulti, isQuery } from '../../guard';

// https://catonmat.net/my-favorite-regex :)
const REGEXP_NON_ASCII = /[^ -~]/m;

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

const ufuzzy = new uFuzzy({
  intraMode: 1,
  intraIns: 1,
  intraSub: 1,
  intraTrn: 1,
  intraDel: 1,
});

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

// Utility function to select all options except 'ALL_VARIABLE_VALUE'
const selectAllOptions = (options: VariableOption[]) =>
  options
    .filter((option) => option.value !== ALL_VARIABLE_VALUE)
    .map((option) => ({
      ...option,
      selected: true,
    }));

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

    /**
     * Toggle the 'All' option or clear selections in the Options Picker dropdown.
     * 1. If 'All' is configured but not selected, and some other options are selected, it deselects all other options and selects only 'All'.
     * 2. If only 'All' is selected, it deselects 'All' and selects all other available options.
     * 3. If some options are selected but 'All' is not configured in the variable,
     *    it clears all selections and defaults to the current behavior for scenarios where 'All' is not configured.
     * 4. If no options are selected, it selects all available options.
     */
    toggleAllOptions: (state, action: PayloadAction): OptionsPickerState => {
      // Check if 'All' option is configured by the user and if it's selected in the dropdown
      const isAllSelected = state.selectedValues.find((option) => option.value === ALL_VARIABLE_VALUE);
      const allOptionConfigured = state.options.find((option) => option.value === ALL_VARIABLE_VALUE);

      // If 'All' option is not selected from the dropdown, but some options are, clear all options and select 'All'
      if (state.selectedValues.length > 0 && !!allOptionConfigured && !isAllSelected) {
        state.selectedValues = [];

        state.selectedValues.push({
          text: allOptionConfigured.text ?? 'All',
          value: allOptionConfigured.value,
          selected: true,
        });

        return applyStateChanges(state, updateOptions);
      }

      // If 'All' option is the only one selected in the dropdown, unselect "All" and select each one of the other options.
      if (isAllSelected && state.selectedValues.length === 1) {
        state.selectedValues = selectAllOptions(state.options);
        return applyStateChanges(state, updateOptions);
      }

      // If some options are selected, but 'All' is not configured by the user, clear the selection and let the
      // current behavior when "All" does not exist and user clear the selected items.
      if (state.selectedValues.length > 0 && !allOptionConfigured) {
        state.selectedValues = [];
        return applyStateChanges(state, updateOptions);
      }

      // If no options are selected and 'All' is not selected, select all options
      state.selectedValues = selectAllOptions(state.options);
      return applyStateChanges(state, updateOptions);
    },

    updateSearchQuery: (state, action: PayloadAction<string>): OptionsPickerState => {
      state.queryValue = action.payload;
      return state;
    },
    updateOptionsAndFilter: (state, action: PayloadAction<VariableOption[]>): OptionsPickerState => {
      const needle = state.queryValue.trim();

      let opts: VariableOption[] = [];

      if (needle === '') {
        opts = action.payload;
      } else if (REGEXP_NON_ASCII.test(needle)) {
        opts = action.payload.filter((o) => o.text.includes(needle));
      } else {
        // with current API, not seeing a way to cache this on state using action.payload's uniqueness
        // since it's recreated and includes selected state on each item :(
        const haystack = action.payload.map(({ text }) => (Array.isArray(text) ? text.toString() : text));

        const [idxs, info, order] = ufuzzy.search(haystack, needle, 5);

        if (idxs?.length) {
          if (info && order) {
            opts = order.map((idx) => action.payload[info.idx[idx]]);
          } else {
            opts = idxs!.map((idx) => action.payload[idx]);
          }

          // always sort $__all to the top, even if exact match exists?
          opts.sort((a, b) => (a.value === ALL_VARIABLE_VALUE ? -1 : 0) - (b.value === ALL_VARIABLE_VALUE ? -1 : 0));
        }
      }

      state.highlightIndex = 0;

      if (needle !== '') {
        // top ranked match index
        let firstMatchIdx = opts.findIndex((o) => o.value !== ALL_VARIABLE_VALUE);

        // if there's no match or no exact match, prepend as-typed option
        if (firstMatchIdx === -1 || opts[firstMatchIdx].value !== needle) {
          opts.unshift({
            selected: false,
            text: '> ' + needle,
            value: needle,
          });

          // if no match at all, select as-typed, else select best match
          state.highlightIndex = firstMatchIdx === -1 ? 0 : firstMatchIdx + 1;
        }
      }

      state.options = opts;

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
