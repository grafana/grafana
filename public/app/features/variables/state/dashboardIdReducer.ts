import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface DashboardIdState {
  uid: string | undefined | null;
}

const initialState: DashboardIdState = { uid: null };

const dashboardIdSlice = createSlice({
  name: 'templating/dashboardId',
  initialState,
  reducers: {
    setVariablesDashboardUId: (state, action: PayloadAction<{ uid: string | undefined }>) => {
      state.uid = action.payload.uid;
    },
    clearVariablesDashboardUId: (state, action: PayloadAction<undefined>) => {
      state.uid = null;
    },
  },
});

export const { setVariablesDashboardUId, clearVariablesDashboardUId } = dashboardIdSlice.actions;

export const dashboardIdReducer = dashboardIdSlice.reducer;
