import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { TransactionStatus } from '../types';

import { removeVariable, variableStateNotStarted } from './sharedReducer';
import {
  initialTransactionState,
  transactionReducer,
  TransactionState,
  variablesClearTransaction,
  variablesCompleteTransaction,
  variablesInitTransaction,
} from './transactionReducer';

describe('transactionReducer', () => {
  describe('when variablesInitTransaction is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<TransactionState>()
        .givenReducer(transactionReducer, { ...initialTransactionState })
        .whenActionIsDispatched(variablesInitTransaction({ uid: 'a uid' }))
        .thenStateShouldEqual({ ...initialTransactionState, uid: 'a uid', status: TransactionStatus.Fetching });
    });
  });

  describe('when variablesCompleteTransaction is dispatched', () => {
    describe('and transaction uid is the same', () => {
      it('then state should be correct', () => {
        reducerTester<TransactionState>()
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
        reducerTester<TransactionState>()
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
      reducerTester<TransactionState>()
        .givenReducer(transactionReducer, {
          ...initialTransactionState,
          uid: 'before',
          status: TransactionStatus.Completed,
        })
        .whenActionIsDispatched(variablesClearTransaction())
        .thenStateShouldEqual({ ...initialTransactionState });
    });
  });

  describe('extraReducers', () => {
    describe('isDirty', () => {
      describe('when called during fetch', () => {
        it('then isDirty should not be changed', () => {
          reducerTester<TransactionState>()
            .givenReducer(transactionReducer, {
              ...initialTransactionState,
              status: TransactionStatus.Fetching,
            })
            .whenActionIsDispatched(removeVariable({} as any))
            .thenStateShouldEqual({ uid: null, status: TransactionStatus.Fetching, isDirty: false });
        });
      });

      describe('when called after clean', () => {
        it('then isDirty should not be changed', () => {
          reducerTester<TransactionState>()
            .givenReducer(transactionReducer, {
              ...initialTransactionState,
              status: TransactionStatus.NotStarted,
            })
            .whenActionIsDispatched(removeVariable({} as any))
            .thenStateShouldEqual({ uid: null, status: TransactionStatus.NotStarted, isDirty: false });
        });
      });

      describe('when called after complete with action that affects isDirty', () => {
        it('then isDirty should be changed', () => {
          reducerTester<TransactionState>()
            .givenReducer(transactionReducer, {
              ...initialTransactionState,
              status: TransactionStatus.Completed,
            })
            .whenActionIsDispatched(removeVariable({} as any))
            .thenStateShouldEqual({ uid: null, status: TransactionStatus.Completed, isDirty: true });
        });
      });

      describe('when called after complete with action that does not affect isDirty', () => {
        it('then isDirty should be changed', () => {
          reducerTester<TransactionState>()
            .givenReducer(transactionReducer, {
              ...initialTransactionState,
              status: TransactionStatus.Completed,
            })
            .whenActionIsDispatched(variableStateNotStarted({} as any))
            .thenStateShouldEqual({ uid: null, status: TransactionStatus.Completed, isDirty: false });
        });
      });
    });
  });
});
