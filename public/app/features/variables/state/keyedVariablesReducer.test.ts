import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { TransactionStatus } from '../types';

import {
  initialKeyedVariablesState,
  keyedVariablesReducer,
  KeyedVariablesState,
  toKeyedAction,
} from './keyedVariablesReducer';
import { getInitialTemplatingState } from './reducers';
import { initialTransactionState, variablesCompleteTransaction, variablesInitTransaction } from './transactionReducer';

describe('dashboardVariablesReducer', () => {
  describe('when an toUidAction is dispatched', () => {
    it('then state should be correct', () => {
      const key = 'key';
      reducerTester<KeyedVariablesState>()
        .givenReducer(keyedVariablesReducer, {
          ...initialKeyedVariablesState,
          lastKey: key,
          keys: {
            [key]: {
              ...getInitialTemplatingState(),
              transaction: {
                ...initialTransactionState,
                uid: key,
              },
            },
          },
        })
        .whenActionIsDispatched(toKeyedAction(key, variablesCompleteTransaction({ uid: key })))
        .thenStateShouldEqual({
          ...initialKeyedVariablesState,
          lastKey: key,
          keys: {
            [key]: {
              ...getInitialTemplatingState(),
              transaction: {
                ...initialTransactionState,
                uid: key,
                status: TransactionStatus.Completed,
              },
            },
          },
        });
    });
  });

  describe('when an toUidAction with variablesInitTransaction is dispatched', () => {
    it('then lastUid property should be correct', () => {
      const lastUid = 'lastUid';
      const key = 'key';
      reducerTester<KeyedVariablesState>()
        .givenReducer(keyedVariablesReducer, {
          ...initialKeyedVariablesState,
          lastKey: lastUid,
          keys: {
            [lastUid]: {
              ...getInitialTemplatingState(),
              transaction: {
                ...initialTransactionState,
                uid: lastUid,
                status: TransactionStatus.Completed,
              },
            },
          },
        })
        .whenActionIsDispatched(toKeyedAction(key, variablesInitTransaction({ uid: key })))
        .thenStateShouldEqual({
          ...initialKeyedVariablesState,
          lastKey: key,
          keys: {
            [key]: {
              ...getInitialTemplatingState(),
              transaction: {
                ...initialTransactionState,
                uid: key,
                status: TransactionStatus.Fetching,
              },
            },
            [lastUid]: {
              ...getInitialTemplatingState(),
              transaction: {
                ...initialTransactionState,
                uid: lastUid,
                status: TransactionStatus.Completed,
              },
            },
          },
        });
    });
  });

  describe('when action other than toUidAction is dispatched', () => {
    it('then state should not be affected', () => {
      const key = 'key';
      reducerTester<KeyedVariablesState>()
        .givenReducer(keyedVariablesReducer, {
          ...initialKeyedVariablesState,
          lastKey: key,
          keys: {
            [key]: {
              ...getInitialTemplatingState(),
              transaction: {
                ...initialTransactionState,
                uid: key,
                status: TransactionStatus.Completed,
              },
            },
          },
        })
        .whenActionIsDispatched(variablesInitTransaction({ uid: 'newUid' }))
        .thenStateShouldEqual({
          ...initialKeyedVariablesState,
          lastKey: key,
          keys: {
            [key]: {
              ...getInitialTemplatingState(),
              transaction: {
                ...initialTransactionState,
                uid: key,
                status: TransactionStatus.Completed,
              },
            },
          },
        });
    });
  });
});
