import { type AnyAction, combineReducers, type Reducer } from 'redux';

import { initialVariableInspectState, variableInspectReducer, type VariableInspectState } from '../inspect/reducer';
import {
  initialOptionPickerState,
  optionsPickerReducer,
  type OptionsPickerState,
} from '../pickers/OptionsPicker/reducer';

import { initialTransactionState, transactionReducer, type TransactionState } from './transactionReducer';
import { initialVariablesState, type VariablesState } from './types';
import { variablesReducer } from './variablesReducer';

export interface TemplatingState {
  variables: VariablesState;
  optionsPicker: OptionsPickerState;
  transaction: TransactionState;
  inspect: VariableInspectState;
}

let templatingReducers: Reducer<TemplatingState, AnyAction, Partial<TemplatingState>>;

export function getTemplatingReducers() {
  if (!templatingReducers) {
    templatingReducers = combineReducers({
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
    variables: initialVariablesState,
    optionsPicker: initialOptionPickerState,
    transaction: initialTransactionState,
    inspect: initialVariableInspectState,
  };
}
