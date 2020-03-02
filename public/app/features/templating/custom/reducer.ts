import { createReducer } from '@reduxjs/toolkit';
import { cloneDeep } from 'lodash';
import { CustomVariableModel, VariableHide, VariableOption } from '../variable';
import { addVariable, changeVariableProp, setCurrentVariableValue } from '../state/actions';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE, emptyUuid, getInstanceState, VariableState } from '../state/types';
import { initialTemplatingState } from '../state/reducers';
import { Deferred } from '../deferred';
import { createCustomOptionsFromQuery } from './actions';

export interface CustomVariableState extends VariableState<CustomVariableModel> {}

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

export const initialCustomVariableState: CustomVariableState = {
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
