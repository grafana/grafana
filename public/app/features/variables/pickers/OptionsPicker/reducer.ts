import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { cloneDeep } from 'lodash';
import { VariableOption, VariableTag, VariableWithMultiSupport, CustomVariableModel } from '../../../templating/types';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from '../../state/types';
import { isQuery, isCustom } from '../../guard';
import { applyStateChanges } from '../../../../core/utils/applyStateChanges';
import { containsSearchFilter } from '../../../templating/utils';
import { getLinkText } from './OptionsPicker';

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
  noclear: boolean;
  editable: boolean;
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
  noclear: false,
  editable: false,
};

export const OPTIONS_LIMIT = 1000;

const getTags = (model: VariableWithMultiSupport) => {
  if (isQuery(model) && Array.isArray(model.tags)) {
    return cloneDeep(model.tags);
  }
  return [];
};

const updateSelectedValues = (state: OptionsPickerState): OptionsPickerState => {
  state.selectedValues = state.options.filter(o => o.selected);
  return state;
};

const applyLimit = (options: VariableOption[]): VariableOption[] => {
  if (!Array.isArray(options)) {
    return [];
  }
  return options.slice(0, Math.min(options.length, OPTIONS_LIMIT));
};

const updateDefaultSelection = (state: OptionsPickerState): OptionsPickerState => {
  const { options } = state;
  if (options.length > 0 && options.filter(o => o.selected).length === 0) {
    options[0].selected = true;
  }
  return state;
};

const updateCustomOption = (str: string, options: VariableOption[]): VariableOption[] => {
  options = options.slice();
  if (options.length > 0 && options[0].custom) {
    // delete previously-added option
    options.shift();
  }
  const match = options.filter(option => {
    return option.text === str;
  });
  if (match.length === 0) {
    // add str to options and deselect all the other options if any
    options.forEach(option => {
      option.selected = false;
    });
    options.unshift({ text: str, value: str, selected: true, custom: true });
  }
  return options;
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
      state.id = action.payload.id!;
      state.queryValue = '';

      if (isCustom(action.payload)) {
        const payload = action.payload as CustomVariableModel;
        const { noclear, editable } = payload;
        state.noclear = noclear ?? false;
        state.editable = editable ?? false;
        if (noclear) {
          state.queryValue = getLinkText(payload);
        }
      }

      if (isQuery(action.payload)) {
        const { queryValue } = action.payload;
        const queryHasSearchFilter = containsSearchFilter(query);
        state.queryValue = queryHasSearchFilter && queryValue ? queryValue : '';
      }

      return applyStateChanges(state, updateSelectedValues);
    },
    hideOptions: (state, action: PayloadAction): OptionsPickerState => {
      return { ...initialState };
    },
    toggleOption: (state, action: PayloadAction<ToggleOption>): OptionsPickerState => {
      const { option, forceSelect, clearOthers } = action.payload;
      const { multi } = state;
      const newOptions: VariableOption[] = state.options.map(o => {
        if (o.value !== option.value) {
          let selected = o.selected;
          if (o.text === ALL_VARIABLE_TEXT || option.text === ALL_VARIABLE_TEXT) {
            selected = false;
          } else if (!multi) {
            selected = false;
          } else if (clearOthers) {
            selected = false;
          }
          o.selected = selected;
          return o;
        }
        o.selected = forceSelect ? true : multi ? !option.selected : true;
        return o;
      });

      state.options = newOptions;
      return applyStateChanges(state, updateDefaultSelection, updateSelectedValues);
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

      state.options = state.options.map(option => {
        if (option.value === ALL_VARIABLE_VALUE && selected === true) {
          option.selected = false;
        }

        if (values.indexOf(option.value) === -1) {
          return option;
        }

        option.selected = selected;
        return option;
      });

      return applyStateChanges(state, updateDefaultSelection, updateSelectedValues);
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
      const selected = !state.options.find(option => option.selected);
      state.options = state.options.map(option => ({
        ...option,
        selected,
      }));

      return applyStateChanges(state, updateSelectedValues);
    },
    updateSearchQuery: (state, action: PayloadAction<string>): OptionsPickerState => {
      state.queryValue = action.payload;
      return state;
    },
    updateOptionsAndFilter: (state, action: PayloadAction<VariableOption[]>): OptionsPickerState => {
      const searchQuery = (state.queryValue ?? '').toLowerCase();
      const { editable } = state;

      const filteredOptions = action.payload.filter(option => {
        const text = Array.isArray(option.text) ? option.text.toString() : option.text;
        return text.toLowerCase().indexOf(searchQuery) !== -1;
      });

      state.options = applyLimit(filteredOptions);
      state.highlightIndex = 0;

      if (editable) {
        state.options = updateCustomOption(state.queryValue, state.options);
      }

      return applyStateChanges(state, updateSelectedValues);
    },
    updateOptionsFromSearch: (state, action: PayloadAction<VariableOption[]>): OptionsPickerState => {
      state.options = applyLimit(action.payload);
      state.highlightIndex = 0;

      return applyStateChanges(state, updateSelectedValues);
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
