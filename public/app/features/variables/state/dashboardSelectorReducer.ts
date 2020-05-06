import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DashboardState } from '../../../types';

export type DashboardSelectorState = () => DashboardState | null;

const initialState: DashboardSelectorState = () => null;

const dashboardSelectorSlice = createSlice({
  name: 'templating/dashboardState',
  initialState,
  reducers: {
    initDashboardSelector: (state, action: PayloadAction<{ selector: () => DashboardState }>) => {
      return action.payload.selector;
    },
    clearDashboardSelector: (state, action: PayloadAction<{ selector: () => DashboardState }>) => {
      return initialState;
    },
  },
});

export const { initDashboardSelector, clearDashboardSelector } = dashboardSelectorSlice.actions;

export const dashboardSelectorReducer = dashboardSelectorSlice.reducer;
