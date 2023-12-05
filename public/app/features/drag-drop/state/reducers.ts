import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { PluginExtensionGlobalDrawerDroppedData } from '@grafana/data';

interface DragDropState {
  data?: PluginExtensionGlobalDrawerDroppedData;
}

export const initialState: DragDropState = {
  data: undefined,
};

const dragDropSlice = createSlice({
  name: 'dragDrop',
  initialState,
  reducers: {
    setDragData: (state: DragDropState, action: PayloadAction<PluginExtensionGlobalDrawerDroppedData | undefined>) => {
      state.data = action.payload;
    },
  },
});

export const { setDragData } = dragDropSlice.actions;

export const dragDropReducer = dragDropSlice.reducer;

export default {
  dragDrop: dragDropReducer,
};
