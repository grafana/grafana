import {
  dashboardVariablesReducer,
  DashboardVariablesState,
  initialDashboardVariablesState,
  toKeyedAction,
} from './dashboardVariablesReducer';
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { initialTransactionState, variablesCompleteTransaction, variablesInitTransaction } from './transactionReducer';
import { TransactionStatus } from '../types';
import { getInitialTemplatingState } from './reducers';

describe('dashboardVariablesReducer', () => {
  describe('when an toUidAction is dispatched', () => {
    it('then state should be correct', () => {
      const key = 'key';
      reducerTester<DashboardVariablesState>()
        .givenReducer(dashboardVariablesReducer, {
          ...initialDashboardVariablesState,
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
          ...initialDashboardVariablesState,
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
      reducerTester<DashboardVariablesState>()
        .givenReducer(dashboardVariablesReducer, {
          ...initialDashboardVariablesState,
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
          ...initialDashboardVariablesState,
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
      reducerTester<DashboardVariablesState>()
        .givenReducer(dashboardVariablesReducer, {
          ...initialDashboardVariablesState,
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
          ...initialDashboardVariablesState,
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
