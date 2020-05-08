import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export enum BatchStatus {
  NotStarted = 'Not started',
  Fetching = 'Fetching',
  Completed = 'Completed',
}

export interface BatchState {
  uid: string | undefined | null;
  status: BatchStatus;
}

export const initialBatchState: BatchState = { uid: null, status: BatchStatus.NotStarted };

const batchStateSlice = createSlice({
  name: 'templating/batch',
  initialState: initialBatchState,
  reducers: {
    variablesInitBatch: (state, action: PayloadAction<{ uid: string | undefined | null }>) => {
      state.uid = action.payload.uid;
      state.status = BatchStatus.Fetching;
    },
    variablesCompleteBatch: (state, action: PayloadAction<{ uid: string | undefined | null }>) => {
      if (state.uid !== action.payload.uid) {
        // this might be an action from a cancelled batch
        return;
      }

      state.status = BatchStatus.Completed;
    },
    variablesClearBatch: (state, action: PayloadAction<undefined>) => {
      state.uid = null;
      state.status = BatchStatus.NotStarted;
    },
  },
});

export const { variablesInitBatch, variablesClearBatch, variablesCompleteBatch } = batchStateSlice.actions;

export const batchStateReducer = batchStateSlice.reducer;
