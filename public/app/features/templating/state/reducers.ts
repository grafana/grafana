import { combineReducers } from '@reduxjs/toolkit';
import { VariableState } from './types';
import {
  initialState as initialOptionPickerState,
  optionsPickerReducer,
  OptionsPickerState,
} from '../pickers/OptionsPicker/reducer';
import { initialVariableEditorState, variableEditorReducer, VariableEditorState } from '../editor/reducer';
import { uuidInEditorReducer } from './uuidInEditorReducer';
import { variablesReducer } from './variablesReducer';

export interface TemplatingState {
  variables: Record<string, VariableState>;
  optionsPicker: OptionsPickerState;
  editor: VariableEditorState;
  uuidInEditor: string | null;
}

export const initialTemplatingState: TemplatingState = {
  variables: {},
  optionsPicker: initialOptionPickerState,
  editor: initialVariableEditorState,
  uuidInEditor: null,
};

export default {
  templating: combineReducers({
    uuidInEditor: uuidInEditorReducer,
    optionsPicker: optionsPickerReducer,
    editor: variableEditorReducer,
    variables: variablesReducer,
  }),
};
