import { createReducer } from '@reduxjs/toolkit';
import _, { cloneDeep } from 'lodash';
import { VariableHide, VariableOption, CustomVariableModel } from '../variable';
import {
  addVariable,
  changeVariableProp,
  changeVariableNameSucceeded,
  changeVariableNameFailed,
  setCurrentVariableValue,
} from '../state/actions';
import {
  emptyUuid,
  initialVariableEditorState,
  VariableEditorState,
  VariableState,
  getInstanceState,
  ALL_VARIABLE_TEXT,
  ALL_VARIABLE_VALUE,
} from '../state/types';
import { initialTemplatingState } from '../state/reducers';
import { Deferred } from '../deferred';
import { createCustomOptionsFromQuery } from './actions';
import { applyStateChanges } from '../state/applyStateChanges';

export interface CustomVariableEditorState extends VariableEditorState {}
export interface CustomVariableState extends VariableState<CustomVariableEditorState, CustomVariableModel> {}

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
  editor: initialCustomVariableEditorState,
  variable: initialCustomVariableModelState,
};

export const customVariableReducer = createReducer(initialTemplatingState, builder =>
  builder
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
    })
    .addCase(changeVariableProp, (state, action) => {
      const instanceState = getInstanceState<CustomVariableState>(state, action.payload.uuid!);
      (instanceState.variable as Record<string, any>)[action.payload.data.propName] = action.payload.data.propValue;

      applyStateChanges(instanceState, updateEditorErrors, updateEditorIsValid);
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
    })
);

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
