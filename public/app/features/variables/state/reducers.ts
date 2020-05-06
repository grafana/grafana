import { combineReducers, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { optionsPickerReducer, OptionsPickerState } from '../pickers/OptionsPicker/reducer';
import { variableEditorReducer, VariableEditorState } from '../editor/reducer';
import { variablesReducer } from './variablesReducer';
import { VariableModel } from '../../templating/types';
import { DashboardState } from '../../../types';
import { cleanUpDashboard } from 'app/features/dashboard/state/reducers';

export interface TemplatingState {
  variables: Record<string, VariableModel>;
  optionsPicker: OptionsPickerState;
  editor: VariableEditorState;
  getDashboardState: () => DashboardState | null;
}

const dashboardSelectorSlice = createSlice({
  name: 'templating/dashboardState',
  initialState: () => null,
  reducers: {
    initDashboardSelector: (state, action: PayloadAction<{ selector: () => DashboardState }>) => {
      return action.payload.selector;
    },
  },
  extraReducers: builder =>
    builder.addCase(cleanUpDashboard, (state, action) => {
      return () => null;
    }),
});

export const { initDashboardSelector } = dashboardSelectorSlice.actions;

export const dashboardSelectorReducer = dashboardSelectorSlice.reducer;

export default {
  templating: combineReducers({
    editor: variableEditorReducer,
    variables: variablesReducer,
    optionsPicker: optionsPickerReducer,
    getDashboardState: dashboardSelectorSlice.reducer,
  }),
};
