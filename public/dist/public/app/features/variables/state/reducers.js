import { combineReducers } from 'redux';
import { initialVariableEditorState, variableEditorReducer } from '../editor/reducer';
import { initialVariableInspectState, variableInspectReducer } from '../inspect/reducer';
import { initialOptionPickerState, optionsPickerReducer } from '../pickers/OptionsPicker/reducer';
import { initialTransactionState, transactionReducer } from './transactionReducer';
import { initialVariablesState } from './types';
import { variablesReducer } from './variablesReducer';
let templatingReducers;
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
//# sourceMappingURL=reducers.js.map