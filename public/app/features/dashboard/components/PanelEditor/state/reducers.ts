import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PanelModel } from '../../../state/PanelModel';

export interface PanelEditorStateNew {
  getPanel: () => PanelModel;
}

export const initialState: PanelEditorStateNew = {
  getPanel: () => new PanelModel({}),
};

const pluginsSlice = createSlice({
  name: 'panelEditorNew',
  initialState,
  reducers: {
    initEditor: (state, action: PayloadAction) => {},
  },
});

// export const { pluginsLoaded } = pluginsSlice.actions;

export const panelEditorReducerNew = pluginsSlice.reducer;
