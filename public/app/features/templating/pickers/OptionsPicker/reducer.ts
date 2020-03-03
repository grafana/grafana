import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import _, { cloneDeep } from 'lodash';
import { containsSearchFilter, VariableOption, VariableTag, VariableWithMultiSupport } from '../../variable';
import { ALL_VARIABLE_TEXT } from '../../state/types';
import { isQuery } from '../../guard';
import { applyStateChanges } from '../../state/applyStateChanges';

export interface ToggleOption {
  option: VariableOption;
  forceSelect: boolean;
  clearOthers: boolean;
}

export interface OptionsPickerState {
  uuid: string;
  selectedValues: VariableOption[];
  selectedTags: VariableTag[];
  searchQuery: string | null;
  highlightIndex: number;
  tags: VariableTag[];
  options: VariableOption[];
  multi: boolean;
}

export const initialState: OptionsPickerState = {
  uuid: null,
  highlightIndex: -1,
  searchQuery: null,
  selectedTags: [],
  selectedValues: [],
  tags: [],
  options: [],
  multi: false,
};

const getTags = (model: VariableWithMultiSupport) => {
  return isQuery(model) ? cloneDeep(model.tags) : [];
};

const updateSelectedValues = (state: OptionsPickerState): OptionsPickerState => {
  state.selectedValues = state.options.filter(o => o.selected);
  return state;
};

const applyLimit = (options: VariableOption[]): VariableOption[] => {
  if (!Array.isArray(options)) {
    return [];
  }
  return options.slice(0, Math.min(options.length, 1000));
};

const optionsPickerSlice = createSlice({
  name: 'templating/optionsPicker',
  initialState,
  reducers: {
    showOptions: (state, action: PayloadAction<VariableWithMultiSupport>): OptionsPickerState => {
      const { query, options, multi, uuid } = action.payload;

      state.highlightIndex = -1;
      state.options = cloneDeep(options);
      state.tags = getTags(action.payload);
      state.multi = multi ?? false;
      state.uuid = uuid;
      // new behaviour, if this is a query that uses searchfilter it might be a nicer
      // user experience to show the last typed search query in the input field
      const queryHasSearchFilter = containsSearchFilter(query);
      state.searchQuery = queryHasSearchFilter && state.searchQuery ? state.searchQuery : '';

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

      if (newOptions.length > 0 && newOptions.filter(o => o.selected).length === 0) {
        newOptions[0].selected = true;
      }

      state.options = newOptions;
      return applyStateChanges(state, updateSelectedValues);
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
        t.valuesText = values.join(' + ');
        t.values = values;
        return t;
      });

      state.options = state.options.map(option => {
        if (values.indexOf(option.value) === -1) {
          return option;
        }

        option.selected = selected;
        return option;
      });

      return applyStateChanges(state, updateSelectedValues);
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
      state.searchQuery = action.payload;
      return state;
    },
    updateOptionsAndFilter: (state, action: PayloadAction<VariableOption[]>): OptionsPickerState => {
      const searchQuery = (state.searchQuery ?? '').toLowerCase();

      state.options = applyLimit(action.payload);
      state.highlightIndex = 0;
      state.options = state.options.filter(option => {
        const text = Array.isArray(option.text) ? option.text.toString() : option.text;
        return text.toLowerCase().indexOf(searchQuery) !== -1;
      });

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
