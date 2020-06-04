import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { cloneDeep, isString, trim } from 'lodash';
import { VariableOption, VariableTag, VariableWithMultiSupport } from '../../types';
import { ALL_VARIABLE_VALUE } from '../../state/types';
import { isQuery } from '../../guard';
import { applyStateChanges } from '../../../../core/utils/applyStateChanges';
import { containsSearchFilter } from '../../utils';

export interface ToggleOption {
  option: VariableOption;
  forceSelect: boolean;
  clearOthers: boolean;
}

export interface OptionsPickerState {
  id: string;
  selectedValues: VariableOption[];
  selectedTags: VariableTag[];
  queryValue: string | null;
  highlightIndex: number;
  tags: VariableTag[];
  options: VariableOption[];
  multi: boolean;
}

export const initialState: OptionsPickerState = {
  id: '',
  highlightIndex: -1,
  queryValue: null,
  selectedTags: [],
  selectedValues: [],
  tags: [],
  options: [],
  multi: false,
};

export const OPTIONS_LIMIT = 1000;

const getTags = (model: VariableWithMultiSupport) => {
  if (isQuery(model) && Array.isArray(model.tags)) {
    return cloneDeep(model.tags);
  }
  return [];
};

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

  state.options = state.options.map(option => {
    if (!isString(option.value)) {
      return option;
    }

    const selected = !!selectedOptions[option.value];

    if (option.selected === selected) {
      return option;
    }

    return { ...option, selected };
  });
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
    state.selectedValues = selectedValues.filter(option => option.value !== ALL_VARIABLE_VALUE);
  }
  return state;
};

const optionsPickerSlice = createSlice({
  name: 'templating/optionsPicker',
  initialState,
  reducers: {
    showOptions: (state, action: PayloadAction<VariableWithMultiSupport>): OptionsPickerState => {
      const { query, options, multi } = action.payload;

      state.highlightIndex = -1;
      state.options = cloneDeep(options);
      state.tags = getTags(action.payload);
      state.multi = multi ?? false;
      state.id = action.payload.id;
      state.queryValue = '';

      if (isQuery(action.payload)) {
        const { queryValue } = action.payload;
        const queryHasSearchFilter = containsSearchFilter(query);
        state.queryValue = queryHasSearchFilter && queryValue ? queryValue : '';
      }

      state.selectedValues = state.options.filter(option => option.selected);
      return applyStateChanges(state, updateDefaultSelection, updateOptions);
    },
    hideOptions: (state, action: PayloadAction): OptionsPickerState => {
      return { ...initialState };
    },
    toggleOption: (state, action: PayloadAction<ToggleOption>): OptionsPickerState => {
      const { option, clearOthers, forceSelect } = action.payload;
      const { multi, selectedValues } = state;
      const selected = !selectedValues.find(o => o.value === option.value);

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

      state.selectedValues = selectedValues.filter(o => o.value !== option.value);
      return applyStateChanges(state, updateDefaultSelection, updateAllSelection, updateOptions);
    },
    toggleTag: (state, action: PayloadAction<VariableTag>): OptionsPickerState => {
      const tag = action.payload;
      const values = tag.values || [];
      const selected = !tag.selected;

      state.tags = state.tags.map(t => {
        if (t.text !== tag.text) {
          return t;
        }

        t.selected = selected;
        t.values = values;

        if (selected) {
          t.valuesText = values.join(' + ');
        } else {
          delete t.valuesText;
        }

        return t;
      });

      const availableOptions = optionsToRecord(state.options);

      if (!selected) {
        state.selectedValues = state.selectedValues.filter(
          option => !isString(option.value) || !availableOptions[option.value]
        );
        return applyStateChanges(state, updateDefaultSelection, updateOptions);
      }

      const optionsFromTag = values
        .filter(value => value !== ALL_VARIABLE_VALUE && !!availableOptions[value])
        .map(value => ({ selected, value, text: value }));

      state.selectedValues.push.apply(state.selectedValues, optionsFromTag);
      return applyStateChanges(state, updateDefaultSelection, updateOptions);
    },
    moveOptionsHighlight: (state, action: PayloadAction<number>): OptionsPickerState => {
      let nextIndex = state.highlightIndex + action.payload;

      if (nextIndex < 0) {
        nextIndex = 0;
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

      state.selectedValues = state.options.map(option => ({
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
      const searchQuery = trim((state.queryValue ?? '').toLowerCase());

      const filteredOptions = action.payload.filter(option => {
        const text = Array.isArray(option.text) ? option.text.toString() : option.text;
        return text.toLowerCase().indexOf(searchQuery) !== -1;
      });

      state.options = applyLimit(filteredOptions);
      state.highlightIndex = 0;

      return applyStateChanges(state, updateDefaultSelection, updateOptions);
    },
    updateOptionsFromSearch: (state, action: PayloadAction<VariableOption[]>): OptionsPickerState => {
      state.options = applyLimit(action.payload);
      state.highlightIndex = 0;

      return applyStateChanges(state, updateDefaultSelection, updateOptions);
    },
  },
});

export const {
  toggleOption,
  showOptions,
  hideOptions,
  toggleTag,
  moveOptionsHighlight,
  toggleAllOptions,
  updateSearchQuery,
  updateOptionsAndFilter,
  updateOptionsFromSearch,
} = optionsPickerSlice.actions;

export const optionsPickerReducer = optionsPickerSlice.reducer;
