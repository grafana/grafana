import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ImportDashboardState {
  gcomDashboard: any;
  gcomError: string;
}

const initialImportDashboardState: ImportDashboardState = {
  gcomDashboard: {},
  gcomError: '',
};

const importDashboardSlice = createSlice({
  name: 'manageDashboards',
  initialState: initialImportDashboardState,
  reducers: {
    setGcomDashboard: (state, action: PayloadAction<any>): ImportDashboardState => ({
      ...state,
      gcomDashboard: action.payload,
    }),
    setGcomError: (state, action: PayloadAction<string>): ImportDashboardState => ({
      ...state,
      gcomError: action.payload,
    }),
  },
});

export const { setGcomDashboard, setGcomError } = importDashboardSlice.actions;

export const importDashboardReducer = importDashboardSlice.reducer;

export default {
  importDashboard: importDashboardReducer,
};
