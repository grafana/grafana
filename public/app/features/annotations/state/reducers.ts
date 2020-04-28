import cloneDeep from 'lodash/cloneDeep';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AnnotationEvent } from '@grafana/data';

import { cleanUpDashboard, cleanUpEditPanel } from 'app/features/dashboard/state/reducers';
import { updateEditorInitState } from '../../dashboard/components/PanelEditor/state/reducers';
import { EDIT_PANEL_ID } from '../../../core/constants';
import { StoreState } from '../../../types';

export type AnnotationsIdentifier = { panelId: number };

export interface AlertState {
  id: number;
  dashboardId: number;
  panelId: number;
  state: string;
  newDateState: string;
}

export interface AnnotationsAndAlertState {
  annotations: AnnotationEvent[];
  alertState: AlertState;
}

export interface AnnotationsState extends Record<string, AnnotationsAndAlertState> {}

export const initialAnnotationsState: AnnotationsState = {};

const UNKNOWN_PANEL_ID = 'UNKNOWN_PANEL_ID';

const annotationsSlice = createSlice({
  name: 'annotations',
  initialState: initialAnnotationsState,
  reducers: {
    setAnnotationsAndAlert: (
      state,
      action: PayloadAction<{
        identifier: AnnotationsIdentifier;
        annotations: AnnotationEvent[];
        alertState: AlertState;
      }>
    ) => {
      const { annotations, alertState, identifier } = action.payload;
      const panelId = identifier.panelId ?? UNKNOWN_PANEL_ID;

      if (!state[panelId]) {
        state[panelId] = { annotations, alertState };
        return;
      }

      state[panelId] = { annotations, alertState };
    },
  },
  extraReducers: builder =>
    builder
      .addCase(cleanUpDashboard, (state, action) => initialAnnotationsState)
      .addCase(updateEditorInitState, (state, action) => {
        const { sourcePanel } = action.payload;
        const sourcePanelId = sourcePanel.id ?? UNKNOWN_PANEL_ID;

        if (!state[sourcePanelId]) {
          return;
        }

        state[EDIT_PANEL_ID] = cloneDeep(state[sourcePanelId]);
      })
      .addCase(cleanUpEditPanel, (state, action) => {
        delete state[EDIT_PANEL_ID];
      }),
});

export const getAnnotationsAndAlertState = (state: StoreState, panelId: number): AnnotationsAndAlertState => {
  const defaultAlertState = ({ state: undefined } as unknown) as AlertState;
  const annotations = state.annotations[panelId] ? state.annotations[panelId].annotations : [];
  const alertState = state.annotations[panelId] ? state.annotations[panelId].alertState : defaultAlertState;

  return { annotations, alertState: alertState ?? defaultAlertState };
};

export const { setAnnotationsAndAlert } = annotationsSlice.actions;

export const annotationsReducer = annotationsSlice.reducer;

export default {
  annotations: annotationsReducer,
};
