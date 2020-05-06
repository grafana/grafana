import { combineReducers } from '@reduxjs/toolkit';
import { optionsPickerReducer, OptionsPickerState } from '../pickers/OptionsPicker/reducer';
import { variableEditorReducer, VariableEditorState } from '../editor/reducer';
import { variablesReducer } from './variablesReducer';
import { VariableModel } from '../../templating/types';
import { DashboardState } from '../../../types';
import { dashboardSelectorReducer } from './dashboardSelectorReducer';

export interface TemplatingState {
  variables: Record<string, VariableModel>;
  optionsPicker: OptionsPickerState;
  editor: VariableEditorState;
  getDashboardState: () => DashboardState | null;
}

export default {
  templating: combineReducers({
    editor: variableEditorReducer,
    variables: variablesReducer,
    optionsPicker: optionsPickerReducer,
    getDashboardState: dashboardSelectorReducer,
  }),
};
