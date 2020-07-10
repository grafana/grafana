import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export enum TransactionStatus {
  NotStarted = 'Not started',
  Fetching = 'Fetching',
  Completed = 'Completed',
}

export interface TransactionState {
  uid: string | undefined | null;
  status: TransactionStatus;
}

export const initialTransactionState: TransactionState = { uid: null, status: TransactionStatus.NotStarted };

const transactionSlice = createSlice({
  name: 'templating/transaction',
  initialState: initialTransactionState,
  reducers: {
    variablesInitTransaction: (state, action: PayloadAction<{ uid: string | undefined | null }>) => {
      state.uid = action.payload.uid;
      state.status = TransactionStatus.Fetching;
    },
    variablesCompleteTransaction: (state, action: PayloadAction<{ uid: string | undefined | null }>) => {
      if (state.uid !== action.payload.uid) {
        // this might be an action from a cancelled batch
        return;
      }

      state.status = TransactionStatus.Completed;
    },
    variablesClearTransaction: (state, action: PayloadAction<undefined>) => {
      state.uid = null;
      state.status = TransactionStatus.NotStarted;
    },
  },
});

export const {
  variablesInitTransaction,
  variablesClearTransaction,
  variablesCompleteTransaction,
} = transactionSlice.actions;

export const transactionReducer = transactionSlice.reducer;
