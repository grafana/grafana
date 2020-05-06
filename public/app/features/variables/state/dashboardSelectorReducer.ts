import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DashboardState } from '../../../types';
import { cleanUpDashboard } from '../../dashboard/state/reducers';

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
