import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type DashboardIdState = string | null;

const initialState: DashboardIdState = null;

const dashboardIdSlice = createSlice({
  name: 'templating/dashboardId',
  initialState,
  reducers: {
    initDashboardId: (state, action: PayloadAction<{ uid: string }>) => {
      return action.payload.uid;
    },
    clearDashboardId: (state, action: PayloadAction<undefined>) => {
      return initialState;
    },
  },
});

export const { initDashboardId, clearDashboardId } = dashboardIdSlice.actions;

export const dashboardIdReducer = dashboardIdSlice.reducer;
