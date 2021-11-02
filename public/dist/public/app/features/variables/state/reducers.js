import { combineReducers } from '@reduxjs/toolkit';
import { optionsPickerReducer } from '../pickers/OptionsPicker/reducer';
import { variableEditorReducer } from '../editor/reducer';
import { variablesReducer } from './variablesReducer';
import { transactionReducer } from './transactionReducer';
import { variableInspectReducer } from '../inspect/reducer';
export var templatingReducers = combineReducers({
    editor: variableEditorReducer,
    variables: variablesReducer,
    optionsPicker: optionsPickerReducer,
    transaction: transactionReducer,
    inspect: variableInspectReducer,
});
export default {
    templating: templatingReducers,
};
//# sourceMappingURL=reducers.js.map