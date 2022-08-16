import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { DataSourceApi, DataSourceRef } from '@grafana/data';

import { VariablePayload } from '../state/types';
import { VariableQueryEditorType } from '../types';

export interface AdHocVariableEditorState {
  infoText?: string;
  dataSources: Array<{ text: string; value: DataSourceRef | null }>;
}

export interface DataSourceVariableEditorState {
  dataSourceTypes: Array<{ text: string; value: string }>;
}

export interface QueryVariableEditorState {
  VariableQueryEditor: VariableQueryEditorType;
  dataSource: DataSourceApi | null;
}

type VariableEditorExtension = AdHocVariableEditorState | DataSourceVariableEditorState | QueryVariableEditorState;

export interface VariableEditorState {
  id: string;
  name: string;
  errors: Record<string, string>;
  isValid: boolean;
  extended: VariableEditorExtension | null;
}

export const initialVariableEditorState: VariableEditorState = {
  id: '',
  isValid: true,
  errors: {},
  name: '',
  extended: null,
};

const variableEditorReducerSlice = createSlice({
  name: 'templating/editor',
  initialState: initialVariableEditorState,
  reducers: {
    variableEditorMounted: (state: VariableEditorState, action: PayloadAction<{ name: string; id: string }>) => {
      state.name = action.payload.name;
      state.id = action.payload.id;
    },
    variableEditorUnMounted: (state: VariableEditorState, action: PayloadAction<VariablePayload>) => {
      return initialVariableEditorState;
    },
    changeVariableNameSucceeded: (
      state: VariableEditorState,
      action: PayloadAction<VariablePayload<{ newName: string }>>
    ) => {
      state.name = action.payload.data.newName;
      delete state.errors['name'];
      state.isValid = Object.keys(state.errors).length === 0;
    },
    changeVariableNameFailed: (
      state: VariableEditorState,
      action: PayloadAction<{ newName: string; errorText: string }>
    ) => {
      state.name = action.payload.newName;
      state.errors.name = action.payload.errorText;
      state.isValid = Object.keys(state.errors).length === 0;
    },
    addVariableEditorError: (
      state: VariableEditorState,
      action: PayloadAction<{ errorProp: string; errorText: any }>
    ) => {
      state.errors[action.payload.errorProp] = action.payload.errorText;
      state.isValid = Object.keys(state.errors).length === 0;
    },
    removeVariableEditorError: (state: VariableEditorState, action: PayloadAction<{ errorProp: string }>) => {
      delete state.errors[action.payload.errorProp];
      state.isValid = Object.keys(state.errors).length === 0;
    },
    changeVariableEditorExtended: (state: VariableEditorState, action: PayloadAction<VariableEditorExtension>) => {
      state.extended = {
        ...state.extended,
        ...action.payload,
      };
    },
    cleanEditorState: () => initialVariableEditorState,
  },
});

export const variableEditorReducer = variableEditorReducerSlice.reducer;

export const {
  changeVariableNameSucceeded,
  changeVariableNameFailed,
  variableEditorMounted,
  variableEditorUnMounted,
  changeVariableEditorExtended,
  addVariableEditorError,
  removeVariableEditorError,
  cleanEditorState,
} = variableEditorReducerSlice.actions;
