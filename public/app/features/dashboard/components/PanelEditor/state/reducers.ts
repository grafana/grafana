import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface PanelEditorStateNew {}

export const initialState: PanelEditorStateNew = {};

const pluginsSlice = createSlice({
  name: 'panelEditorNew',
  initialState,
  reducers: {
    initEditor: (state, action: PayloadAction) => {},
  },
});

// export const { pluginsLoaded } = pluginsSlice.actions;

export const panelEditorReducerNew = pluginsSlice.reducer;
