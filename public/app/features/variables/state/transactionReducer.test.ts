import { reducerTester } from '../../../../test/core/redux/reducerTester';
import {
  initialTransactionState,
  transactionReducer,
  TransactionStatus,
  variablesClearTransaction,
  variablesCompleteTransaction,
  variablesInitTransaction,
} from './transactionReducer';

describe('transactionReducer', () => {
  describe('when variablesInitTransaction is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester()
        .givenReducer(transactionReducer, { ...initialTransactionState })
        .whenActionIsDispatched(variablesInitTransaction({ uid: 'a uid' }))
        .thenStateShouldEqual({ ...initialTransactionState, uid: 'a uid', status: TransactionStatus.Fetching });
    });
  });

  describe('when variablesCompleteTransaction is dispatched', () => {
    describe('and transaction uid is the same', () => {
      it('then state should be correct', () => {
        reducerTester()
          .givenReducer(transactionReducer, {
            ...initialTransactionState,
            uid: 'before',
            status: TransactionStatus.Fetching,
          })
          .whenActionIsDispatched(variablesCompleteTransaction({ uid: 'before' }))
          .thenStateShouldEqual({ ...initialTransactionState, uid: 'before', status: TransactionStatus.Completed });
      });
    });

    describe('and transaction uid is not the same', () => {
      it('then state should be correct', () => {
        reducerTester()
          .givenReducer(transactionReducer, {
            ...initialTransactionState,
            uid: 'before',
            status: TransactionStatus.Fetching,
          })
          .whenActionIsDispatched(variablesCompleteTransaction({ uid: 'after' }))
          .thenStateShouldEqual({ ...initialTransactionState, uid: 'before', status: TransactionStatus.Fetching });
      });
    });
  });

  describe('when variablesClearTransaction is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester()
        .givenReducer(transactionReducer, {
          ...initialTransactionState,
          uid: 'before',
          status: TransactionStatus.Completed,
        })
        .whenActionIsDispatched(variablesClearTransaction())
        .thenStateShouldEqual({ ...initialTransactionState });
    });
  });
});
