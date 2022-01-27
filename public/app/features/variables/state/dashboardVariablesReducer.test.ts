import {
  dashboardVariablesReducer,
  DashboardVariablesState,
  initialDashboardVariablesState,
  toUidAction,
} from './dashboardVariablesReducer';
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { initialTransactionState, variablesCompleteTransaction, variablesInitTransaction } from './transactionReducer';
import { TransactionStatus } from '../types';
import { getInitialTemplatingState } from './reducers';

describe('dashboardVariablesReducer', () => {
  describe('when an toUidAction is dispatched', () => {
    it('then state should be correct', () => {
      const uid = 'uid';
      reducerTester<DashboardVariablesState>()
        .givenReducer(dashboardVariablesReducer, {
          ...initialDashboardVariablesState,
          lastUid: uid,
          slices: {
            [uid]: {
              ...getInitialTemplatingState(),
              transaction: {
                ...initialTransactionState,
                uid,
              },
            },
          },
        })
        .whenActionIsDispatched(toUidAction(uid, variablesCompleteTransaction({ uid })))
        .thenStateShouldEqual({
          ...initialDashboardVariablesState,
          lastUid: uid,
          slices: {
            [uid]: {
              ...getInitialTemplatingState(),
              transaction: {
                ...initialTransactionState,
                uid,
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
      const uid = 'uid';
      reducerTester<DashboardVariablesState>()
        .givenReducer(dashboardVariablesReducer, {
          ...initialDashboardVariablesState,
          lastUid,
          slices: {
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
        .whenActionIsDispatched(toUidAction(uid, variablesInitTransaction({ uid })))
        .thenStateShouldEqual({
          ...initialDashboardVariablesState,
          lastUid: uid,
          slices: {
            [uid]: {
              ...getInitialTemplatingState(),
              transaction: {
                ...initialTransactionState,
                uid,
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
      const uid = 'uid';
      reducerTester<DashboardVariablesState>()
        .givenReducer(dashboardVariablesReducer, {
          ...initialDashboardVariablesState,
          lastUid: uid,
          slices: {
            [uid]: {
              ...getInitialTemplatingState(),
              transaction: {
                ...initialTransactionState,
                uid,
                status: TransactionStatus.Completed,
              },
            },
          },
        })
        .whenActionIsDispatched(variablesInitTransaction({ uid: 'newUid' }))
        .thenStateShouldEqual({
          ...initialDashboardVariablesState,
          lastUid: uid,
          slices: {
            [uid]: {
              ...getInitialTemplatingState(),
              transaction: {
                ...initialTransactionState,
                uid,
                status: TransactionStatus.Completed,
              },
            },
          },
        });
    });
  });
});
