import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { VariablePayload } from '../state/types';

type VariableEditorExtension<ExtendedProps extends {} = {}> = { [P in keyof ExtendedProps]: ExtendedProps[P] };
export interface VariableEditorState<ExtendedProps extends {} = {}> {
  id: string;
  name: string;
  errors: Record<string, string>;
  isValid: boolean;
  extended: VariableEditorExtension<ExtendedProps> | null;
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
    setIdInEditor: (state: VariableEditorState, action: PayloadAction<{ id: string }>) => {
      state.id = action.payload.id;
    },
    clearIdInEditor: (state: VariableEditorState, action: PayloadAction<undefined>) => {
      state.id = '';
    },
    variableEditorMounted: (state: VariableEditorState, action: PayloadAction<{ name: string }>) => {
      state.name = action.payload.name;
    },
    variableEditorUnMounted: (state: VariableEditorState, action: PayloadAction<VariablePayload>) => {
      return initialVariableEditorState;
    },
    changeVariableNameSucceeded: (state: VariableEditorState, action: PayloadAction<VariablePayload<string>>) => {
      state.name = action.payload.data;
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
    changeVariableEditorExtended: (
      state: VariableEditorState,
      action: PayloadAction<{ propName: string; propValue: any }>
    ) => {
      state.extended = {
        ...state.extended,
        [action.payload.propName]: action.payload.propValue,
      };
    },
  },
});

export const variableEditorReducer = variableEditorReducerSlice.reducer;

export const {
  setIdInEditor,
  clearIdInEditor,
  changeVariableNameSucceeded,
  changeVariableNameFailed,
  variableEditorMounted,
  variableEditorUnMounted,
  changeVariableEditorExtended,
  addVariableEditorError,
  removeVariableEditorError,
} = variableEditorReducerSlice.actions;
