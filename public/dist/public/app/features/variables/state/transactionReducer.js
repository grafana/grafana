import { createSlice } from '@reduxjs/toolkit';
import { TransactionStatus } from '../types';
import { addVariable, changeVariableOrder, changeVariableProp, changeVariableType, duplicateVariable, removeVariable, } from './sharedReducer';
export const initialTransactionState = {
    uid: null,
    status: TransactionStatus.NotStarted,
    isDirty: false,
};
const transactionSlice = createSlice({
    name: 'templating/transaction',
    initialState: initialTransactionState,
    reducers: {
        variablesInitTransaction: (state, action) => {
            state.uid = action.payload.uid;
            state.status = TransactionStatus.Fetching;
        },
        variablesCompleteTransaction: (state, action) => {
            if (state.uid !== action.payload.uid) {
                // this might be an action from a cancelled batch
                return;
            }
            state.status = TransactionStatus.Completed;
        },
        variablesClearTransaction: (state, action) => {
            state.uid = null;
            state.status = TransactionStatus.NotStarted;
            state.isDirty = false;
        },
    },
    extraReducers: (builder) => builder.addMatcher(actionAffectsDirtyState, (state, action) => {
        if (state.status === TransactionStatus.Completed) {
            state.isDirty = true;
        }
    }),
});
function actionAffectsDirtyState(action) {
    return (removeVariable.match(action) ||
        addVariable.match(action) ||
        changeVariableProp.match(action) ||
        changeVariableOrder.match(action) ||
        duplicateVariable.match(action) ||
        changeVariableType.match(action));
}
export const { variablesInitTransaction, variablesClearTransaction, variablesCompleteTransaction } = transactionSlice.actions;
export const transactionReducer = transactionSlice.reducer;
//# sourceMappingURL=transactionReducer.js.map