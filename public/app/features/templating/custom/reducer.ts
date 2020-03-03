import { createReducer } from '@reduxjs/toolkit';
import { CustomVariableModel, VariableHide, VariableOption } from '../variable';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE, emptyUuid, getInstanceState, VariableState } from '../state/types';
import { createCustomOptionsFromQuery } from './actions';
import { initialVariablesState } from '../state/variablesReducer';

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

export const customVariableReducer = createReducer(initialVariablesState, builder =>
  builder.addCase(createCustomOptionsFromQuery, (state, action) => {
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
);
