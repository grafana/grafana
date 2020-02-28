import { createReducer } from '@reduxjs/toolkit';
import _, { cloneDeep } from 'lodash';
import { VariableHide, VariableOption, CustomVariableModel } from '../variable';
import {
  addVariable,
  changeVariableProp,
  changeVariableNameSucceeded,
  changeVariableNameFailed,
  toggleAllVariableOptions,
  showVariableDropDown,
  hideVariableDropDown,
  selectVariableOption,
  setCurrentVariableValue,
} from '../state/actions';
import {
  emptyUuid,
  initialVariableEditorState,
  VariableEditorState,
  VariableState,
  getInstanceState,
} from '../state/types';
import { initialTemplatingState, TemplatingState } from '../state/reducers';
import { Deferred } from '../deferred';
import { createCustomOptionsFromQuery } from './actions';
import { applyStateChanges } from '../state/applyStateChanges';

export interface CustomVariablePickerState {
  showDropDown: boolean;
  selectedValues: VariableOption[];
  highlightIndex: number;
  options: VariableOption[];
  oldVariableText: string | string[] | null;
  searchQuery: string | null;
}

/** TODO: use the VariableEditorState directly? */
export interface CustomVariableEditorState extends VariableEditorState {}

export interface CustomVariableState
  extends VariableState<CustomVariablePickerState, CustomVariableEditorState, CustomVariableModel> {}

export const initialCustomVariablePickerState: CustomVariablePickerState = {
  highlightIndex: -1,
  searchQuery: null,
  selectedValues: [],
  showDropDown: false,
  options: [],
  oldVariableText: null,
};

export const initialCustomVariableModelState: CustomVariableModel = {
  uuid: emptyUuid,
  global: false,
  multi: false,
  includeAll: false,
  allValue: null,
  query: '',
  options: [],
  current: {} as VariableOption,
  name: '',
  type: 'custom',
  label: null,
  hide: VariableHide.dontHide,
  skipUrlSync: false,
  index: -1,
  initLock: null,
};

export const initialCustomVariableEditorState: CustomVariableEditorState = {
  ...initialVariableEditorState,
  type: 'custom',
};

export const initialCustomVariableState: CustomVariableState = {
  picker: initialCustomVariablePickerState,
  editor: initialCustomVariableEditorState,
  variable: initialCustomVariableModelState,
};

const hideOtherDropDowns = (state: TemplatingState) => {
  // hack that closes drop downs that already are opened
  // could be solved by moving picker state to
  // 1. A separate picker state slice under templating in Redux
  //  PROS:
  //    - smaller state tree
  //    - no need for this hack since there's only one picker state
  //  CONS:
  //    - state for a variable is no longer in one place but spread out under variables.variable and templating[type].picker templating[type].editor
  //    - picker state will also need addressing like type and uuid to filter out picker state
  // 2. Use local React state instead
  //  PROS:
  //    - no state tree
  //    - no need for this hack
  //  CONS:
  //    - lot's of code and logic that has to move into component
  //    - harder to test component, easier to test reducer
  const openedDropDowns = Object.values(state.variables).filter(s => {
    if (s.variable.type === 'custom') {
      return (s.picker as CustomVariablePickerState).showDropDown;
    }
    return false;
  });
  openedDropDowns.map(state => {
    state.picker = initialCustomVariablePickerState;
    return state;
  });
};

/**
 * TODO:
 * Should be moved somewhere so we can reference them in both custom
 * and query reducer. Copy/paste just to get something working.
 */
export const ALL_VARIABLE_TEXT = 'All';
export const ALL_VARIABLE_VALUE = '$__all';
export const NONE_VARIABLE_TEXT = 'None';
export const NONE_VARIABLE_VALUE = '';

export const customVariableReducer = createReducer(initialTemplatingState, builder =>
  builder
    .addCase(toggleAllVariableOptions, (state, action) => {
      const instanceState = getInstanceState<CustomVariableState>(state, action.payload.uuid!);
      const { options } = instanceState.variable;
      const selected = !options.find(option => option.selected);

      instanceState.variable.options = options.map(option => ({
        ...option,
        selected,
      }));

      applyStateChanges(instanceState, updateOptions, updateSelectedValues, updateCurrent);
    })
    .addCase(addVariable, (state, action) => {
      state.variables[action.payload.uuid!] = cloneDeep(initialCustomVariableState);
      state.variables[action.payload.uuid!].variable = {
        ...state.variables[action.payload.uuid!].variable,
        ...action.payload.data.model,
      };
      state.variables[action.payload.uuid!].variable.uuid = action.payload.uuid;
      state.variables[action.payload.uuid!].variable.index = action.payload.data.index;
      state.variables[action.payload.uuid!].variable.global = action.payload.data.global;
      state.variables[action.payload.uuid!].variable.initLock = new Deferred();
    })
    .addCase(changeVariableNameSucceeded, (state, action) => {
      const instanceState = getInstanceState<CustomVariableState>(state, action.payload.uuid!);
      delete instanceState.editor.errors['name'];
      instanceState.editor.name = action.payload.data;
      instanceState.variable.name = action.payload.data;
      applyStateChanges(instanceState, updateEditorIsValid);
    })
    .addCase(changeVariableNameFailed, (state, action) => {
      const instanceState = getInstanceState<CustomVariableState>(state, action.payload.uuid!);
      instanceState.editor.name = action.payload.data.newName;
      instanceState.editor.errors.name = action.payload.data.errorText;
      applyStateChanges(instanceState, updateEditorIsValid);
    })
    .addCase(createCustomOptionsFromQuery, (state, action) => {
      const instanceState = getInstanceState<CustomVariableState>(state, action.payload.uuid);
      const { includeAll, query } = instanceState.variable;
      const match = query.match(/(?:\\,|[^,])+/g) ?? [];

      const options = match.map(text => {
        text = text.replace(/\\,/g, ',');
        return { text: text.trim(), value: text.trim(), selected: false };
      });

      if (includeAll) {
        options.unshift({ text: ALL_VARIABLE_TEXT, value: ALL_VARIABLE_VALUE, selected: false });
      }

      instanceState.variable.options = options;
      applyStateChanges(instanceState, updateOptions);
    })
    .addCase(changeVariableProp, (state, action) => {
      const instanceState = getInstanceState<CustomVariableState>(state, action.payload.uuid!);
      (instanceState.variable as Record<string, any>)[action.payload.data.propName] = action.payload.data.propValue;

      applyStateChanges(instanceState, updateEditorErrors, updateEditorIsValid);
    })
    .addCase(showVariableDropDown, (state, action) => {
      hideOtherDropDowns(state);
      const instanceState = getInstanceState<CustomVariableState>(state, action.payload.uuid!);
      const oldVariableText = instanceState.picker.oldVariableText || instanceState.variable.current.text;
      const highlightIndex = -1;
      const showDropDown = true;
      // const queryHasSearchFilter = getQueryHasSearchFilter(instanceState.variable);
      // // new behaviour, if this is a query that uses searchfilter it might be a nicer
      // // user experience to show the last typed search query in the input field
      // const searchQuery =
      //   queryHasSearchFilter && instanceState.picker.searchQuery ? instanceState.picker.searchQuery : '';

      instanceState.picker.oldVariableText = oldVariableText;
      instanceState.picker.highlightIndex = highlightIndex;
      //instanceState.picker.searchQuery = searchQuery;
      instanceState.picker.showDropDown = showDropDown;

      applyStateChanges(instanceState, updateOptions, updateSelectedValues);
    })
    .addCase(hideVariableDropDown, (state, action) => {
      const instanceState = getInstanceState<CustomVariableState>(state, action.payload.uuid!);
      instanceState.picker.showDropDown = false;

      applyStateChanges(instanceState, updateOptions, updateSelectedValues);
    })
    .addCase(selectVariableOption, (state, action) => {
      const instanceState = getInstanceState<CustomVariableState>(state, action.payload.uuid!);
      const { option, forceSelect, event } = action.payload.data;
      const { multi } = instanceState.variable;
      const newOptions: VariableOption[] = instanceState.variable.options.map(o => {
        if (o.value !== option.value) {
          let selected = o.selected;
          if (o.text === ALL_VARIABLE_TEXT || option.text === ALL_VARIABLE_TEXT) {
            selected = false;
          } else if (!multi) {
            selected = false;
          } else if (event && (event.ctrlKey || event.metaKey || event.shiftKey)) {
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

      instanceState.variable.options = newOptions;
      applyStateChanges(instanceState, updateOptions, updateSelectedValues, updateCurrent);
    })
    .addCase(setCurrentVariableValue, (state, action) => {
      const instanceState = getInstanceState<CustomVariableState>(state, action.payload.uuid);
      const current = { ...action.payload.data };

      if (Array.isArray(current.text) && current.text.length > 0) {
        current.text = current.text.join(' + ');
      } else if (Array.isArray(current.value) && current.value[0] !== ALL_VARIABLE_VALUE) {
        current.text = current.value.join(' + ');
      }

      instanceState.variable.current = current;
      instanceState.variable.options = instanceState.variable.options.map(option => {
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
        option.selected = selected;
        return option;
      });

      applyStateChanges(instanceState, updateOptions, updateSelectedValues, updateOldVariableText);
    })
);

const updateOldVariableText = (state: CustomVariableState): CustomVariableState => {
  state.picker.oldVariableText = state.variable.current.text;
  return state;
};

const updateEditorErrors = (state: CustomVariableState): CustomVariableState => {
  let errorText = null;
  if (
    typeof state.variable.query === 'string' &&
    state.variable.query.match(new RegExp('\\$' + state.variable.name + '(/| |$)'))
  ) {
    errorText = 'TODO: add better error message and validation..';
  }

  if (!errorText) {
    delete state.editor.errors.query;
    return state;
  }

  state.editor.errors.query = errorText;
  return state;
};

const updateEditorIsValid = (state: CustomVariableState): CustomVariableState => {
  state.editor.isValid = Object.keys(state.editor.errors).length === 0;
  return state;
};

const updateSelectedValues = (state: CustomVariableState): CustomVariableState => {
  state.picker.selectedValues = state.variable.options.filter(o => o.selected);
  return state;
};

const updateOptions = (state: CustomVariableState): CustomVariableState => {
  state.picker.options = state.variable.options.slice(0, Math.min(state.variable.options.length, 1000));
  return state;
};

const updateCurrent = (state: CustomVariableState): CustomVariableState => {
  const { options, searchQuery, selectedValues } = state.picker;

  state.variable.current.value = selectedValues.map(v => v.value) as string[];
  state.variable.current.text = selectedValues.map(v => v.text).join(' + ');

  if (!state.variable.multi) {
    state.variable.current.value = selectedValues[0].value;
  }

  // if we have a search query and no options use that
  if (options.length === 0 && searchQuery && searchQuery.length > 0) {
    state.variable.current = { text: searchQuery, value: searchQuery, selected: false };
  }

  return state;
};
