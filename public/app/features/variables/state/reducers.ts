import { combineReducers } from '@reduxjs/toolkit';
import { optionsPickerReducer, OptionsPickerState } from '../pickers/OptionsPicker/reducer';
import { variableEditorReducer, VariableEditorState } from '../editor/reducer';
import { variablesReducer } from './variablesReducer';
import { VariableModel } from '../types';
import { transactionReducer, TransactionState } from './transactionReducer';

export interface TemplatingState {
  variables: Record<string, VariableModel>;
  optionsPicker: OptionsPickerState;
  editor: VariableEditorState;
  transaction: TransactionState;
}

export const templatingReducers = combineReducers({
  editor: variableEditorReducer,
  variables: variablesReducer,
  optionsPicker: optionsPickerReducer,
  transaction: transactionReducer,
});

export default {
  templating: templatingReducers,
};
