import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { TransactionStatus } from '../types';
import { removeVariable, variableStateNotStarted } from './sharedReducer';
import { initialTransactionState, transactionReducer, variablesClearTransaction, variablesCompleteTransaction, variablesInitTransaction, } from './transactionReducer';
describe('transactionReducer', () => {
    describe('when variablesInitTransaction is dispatched', () => {
        it('then state should be correct', () => {
            reducerTester()
                .givenReducer(transactionReducer, Object.assign({}, initialTransactionState))
                .whenActionIsDispatched(variablesInitTransaction({ uid: 'a uid' }))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialTransactionState), { uid: 'a uid', status: TransactionStatus.Fetching }));
        });
    });
    describe('when variablesCompleteTransaction is dispatched', () => {
        describe('and transaction uid is the same', () => {
            it('then state should be correct', () => {
                reducerTester()
                    .givenReducer(transactionReducer, Object.assign(Object.assign({}, initialTransactionState), { uid: 'before', status: TransactionStatus.Fetching }))
                    .whenActionIsDispatched(variablesCompleteTransaction({ uid: 'before' }))
                    .thenStateShouldEqual(Object.assign(Object.assign({}, initialTransactionState), { uid: 'before', status: TransactionStatus.Completed }));
            });
        });
        describe('and transaction uid is not the same', () => {
            it('then state should be correct', () => {
                reducerTester()
                    .givenReducer(transactionReducer, Object.assign(Object.assign({}, initialTransactionState), { uid: 'before', status: TransactionStatus.Fetching }))
                    .whenActionIsDispatched(variablesCompleteTransaction({ uid: 'after' }))
                    .thenStateShouldEqual(Object.assign(Object.assign({}, initialTransactionState), { uid: 'before', status: TransactionStatus.Fetching }));
            });
        });
    });
    describe('when variablesClearTransaction is dispatched', () => {
        it('then state should be correct', () => {
            reducerTester()
                .givenReducer(transactionReducer, Object.assign(Object.assign({}, initialTransactionState), { uid: 'before', status: TransactionStatus.Completed }))
                .whenActionIsDispatched(variablesClearTransaction())
                .thenStateShouldEqual(Object.assign({}, initialTransactionState));
        });
    });
    describe('extraReducers', () => {
        describe('isDirty', () => {
            describe('when called during fetch', () => {
                it('then isDirty should not be changed', () => {
                    reducerTester()
                        .givenReducer(transactionReducer, Object.assign(Object.assign({}, initialTransactionState), { status: TransactionStatus.Fetching }))
                        .whenActionIsDispatched(removeVariable({}))
                        .thenStateShouldEqual({ uid: null, status: TransactionStatus.Fetching, isDirty: false });
                });
            });
            describe('when called after clean', () => {
                it('then isDirty should not be changed', () => {
                    reducerTester()
                        .givenReducer(transactionReducer, Object.assign(Object.assign({}, initialTransactionState), { status: TransactionStatus.NotStarted }))
                        .whenActionIsDispatched(removeVariable({}))
                        .thenStateShouldEqual({ uid: null, status: TransactionStatus.NotStarted, isDirty: false });
                });
            });
            describe('when called after complete with action that affects isDirty', () => {
                it('then isDirty should be changed', () => {
                    reducerTester()
                        .givenReducer(transactionReducer, Object.assign(Object.assign({}, initialTransactionState), { status: TransactionStatus.Completed }))
                        .whenActionIsDispatched(removeVariable({}))
                        .thenStateShouldEqual({ uid: null, status: TransactionStatus.Completed, isDirty: true });
                });
            });
            describe('when called after complete with action that does not affect isDirty', () => {
                it('then isDirty should be changed', () => {
                    reducerTester()
                        .givenReducer(transactionReducer, Object.assign(Object.assign({}, initialTransactionState), { status: TransactionStatus.Completed }))
                        .whenActionIsDispatched(variableStateNotStarted({}))
                        .thenStateShouldEqual({ uid: null, status: TransactionStatus.Completed, isDirty: false });
                });
            });
        });
    });
});
//# sourceMappingURL=transactionReducer.test.js.map