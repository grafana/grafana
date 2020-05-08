import { combineReducers } from '@reduxjs/toolkit';
import { optionsPickerReducer, OptionsPickerState } from '../pickers/OptionsPicker/reducer';
import { variableEditorReducer, VariableEditorState } from '../editor/reducer';
import { variablesReducer } from './variablesReducer';
import { VariableModel } from '../../templating/types';
import { BatchState, batchStateReducer } from './batchStateReducer';

export interface TemplatingState {
  variables: Record<string, VariableModel>;
  optionsPicker: OptionsPickerState;
  editor: VariableEditorState;
  batch: BatchState;
}

export const templatingReducers = combineReducers({
  editor: variableEditorReducer,
  variables: variablesReducer,
  optionsPicker: optionsPickerReducer,
  batch: batchStateReducer,
});

export default {
  templating: templatingReducers,
};
