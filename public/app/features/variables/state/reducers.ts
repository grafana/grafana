import { combineReducers } from '@reduxjs/toolkit';
import { optionsPickerReducer, OptionsPickerState } from '../pickers/OptionsPicker/reducer';
import { variableEditorReducer, VariableEditorState } from '../editor/reducer';
import { variablesReducer } from './variablesReducer';
import { VariableModel } from '../types';
import { transactionReducer, TransactionState } from './transactionReducer';
import { variableInspectReducer, VariableInspectState } from '../inspect/reducer';

export interface TemplatingState {
  variables: Record<string, VariableModel>;
  optionsPicker: OptionsPickerState;
  editor: VariableEditorState;
  transaction: TransactionState;
  inspect: VariableInspectState;
}

export const templatingReducers = combineReducers({
  editor: variableEditorReducer,
  variables: variablesReducer,
  optionsPicker: optionsPickerReducer,
  transaction: transactionReducer,
  inspect: variableInspectReducer,
});

export default {
  templating: templatingReducers,
};
