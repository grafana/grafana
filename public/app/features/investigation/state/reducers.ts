import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface InvestigationState {
  data: object | object[] | undefined;
}

export const initialState: InvestigationState = {
  data: undefined,
};

const investigationSlice = createSlice({
  name: 'investigation',
  initialState,
  reducers: {
    setDragData: (state: InvestigationState, action: PayloadAction<object | object[] | undefined>) => {
      state.data = action.payload;
    },
  },
});

export const { setDragData } = investigationSlice.actions;

export const investigationReducer = investigationSlice.reducer;

export default {
  investigation: investigationReducer,
};
