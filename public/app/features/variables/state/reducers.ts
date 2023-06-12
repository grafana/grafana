import { CombinedState, combineReducers, Reducer } from 'redux';

import { initialVariableEditorState, variableEditorReducer, VariableEditorState } from '../editor/reducer';
import { initialVariableInspectState, variableInspectReducer, VariableInspectState } from '../inspect/reducer';
import { initialOptionPickerState, optionsPickerReducer, OptionsPickerState } from '../pickers/OptionsPicker/reducer';

import { initialTransactionState, transactionReducer, TransactionState } from './transactionReducer';
import { initialVariablesState, VariablesState } from './types';
import { variablesReducer } from './variablesReducer';

export interface TemplatingState {
  editor: VariableEditorState;
  variables: VariablesState;
  optionsPicker: OptionsPickerState;
  transaction: TransactionState;
  inspect: VariableInspectState;
}

let templatingReducers: Reducer<CombinedState<TemplatingState>>;

export function getTemplatingReducers() {
  if (!templatingReducers) {
    templatingReducers = combineReducers({
      editor: variableEditorReducer,
      variables: variablesReducer,
      optionsPicker: optionsPickerReducer,
      transaction: transactionReducer,
      inspect: variableInspectReducer,
    });
  }

  return templatingReducers;
}

export function getInitialTemplatingState() {
  return {
    editor: initialVariableEditorState,
    variables: initialVariablesState,
    optionsPicker: initialOptionPickerState,
    transaction: initialTransactionState,
    inspect: initialVariableInspectState,
  };
}
