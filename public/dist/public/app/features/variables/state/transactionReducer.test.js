import { __assign } from "tslib";
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { initialTransactionState, transactionReducer, TransactionStatus, variablesClearTransaction, variablesCompleteTransaction, variablesInitTransaction, } from './transactionReducer';
describe('transactionReducer', function () {
    describe('when variablesInitTransaction is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(transactionReducer, __assign({}, initialTransactionState))
                .whenActionIsDispatched(variablesInitTransaction({ uid: 'a uid' }))
                .thenStateShouldEqual(__assign(__assign({}, initialTransactionState), { uid: 'a uid', status: TransactionStatus.Fetching }));
        });
    });
    describe('when variablesCompleteTransaction is dispatched', function () {
        describe('and transaction uid is the same', function () {
            it('then state should be correct', function () {
                reducerTester()
                    .givenReducer(transactionReducer, __assign(__assign({}, initialTransactionState), { uid: 'before', status: TransactionStatus.Fetching }))
                    .whenActionIsDispatched(variablesCompleteTransaction({ uid: 'before' }))
                    .thenStateShouldEqual(__assign(__assign({}, initialTransactionState), { uid: 'before', status: TransactionStatus.Completed }));
            });
        });
        describe('and transaction uid is not the same', function () {
            it('then state should be correct', function () {
                reducerTester()
                    .givenReducer(transactionReducer, __assign(__assign({}, initialTransactionState), { uid: 'before', status: TransactionStatus.Fetching }))
                    .whenActionIsDispatched(variablesCompleteTransaction({ uid: 'after' }))
                    .thenStateShouldEqual(__assign(__assign({}, initialTransactionState), { uid: 'before', status: TransactionStatus.Fetching }));
            });
        });
    });
    describe('when variablesClearTransaction is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(transactionReducer, __assign(__assign({}, initialTransactionState), { uid: 'before', status: TransactionStatus.Completed }))
                .whenActionIsDispatched(variablesClearTransaction())
                .thenStateShouldEqual(__assign({}, initialTransactionState));
        });
    });
});
//# sourceMappingURL=transactionReducer.test.js.map