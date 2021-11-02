var _a;
import { createSlice } from '@reduxjs/toolkit';
export var TransactionStatus;
(function (TransactionStatus) {
    TransactionStatus["NotStarted"] = "Not started";
    TransactionStatus["Fetching"] = "Fetching";
    TransactionStatus["Completed"] = "Completed";
})(TransactionStatus || (TransactionStatus = {}));
export var initialTransactionState = { uid: null, status: TransactionStatus.NotStarted };
var transactionSlice = createSlice({
    name: 'templating/transaction',
    initialState: initialTransactionState,
    reducers: {
        variablesInitTransaction: function (state, action) {
            state.uid = action.payload.uid;
            state.status = TransactionStatus.Fetching;
        },
        variablesCompleteTransaction: function (state, action) {
            if (state.uid !== action.payload.uid) {
                // this might be an action from a cancelled batch
                return;
            }
            state.status = TransactionStatus.Completed;
        },
        variablesClearTransaction: function (state, action) {
            state.uid = null;
            state.status = TransactionStatus.NotStarted;
        },
    },
});
export var variablesInitTransaction = (_a = transactionSlice.actions, _a.variablesInitTransaction), variablesClearTransaction = _a.variablesClearTransaction, variablesCompleteTransaction = _a.variablesCompleteTransaction;
export var transactionReducer = transactionSlice.reducer;
//# sourceMappingURL=transactionReducer.js.map