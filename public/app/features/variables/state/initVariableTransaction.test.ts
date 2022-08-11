import { DataSourceRef, LoadingState } from '@grafana/data/src';
import { setDataSourceSrv } from '@grafana/runtime/src';

import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { toAsyncOfResult } from '../../query/state/DashboardQueryRunner/testHelpers';
import { variableAdapters } from '../adapters';
import { createAdHocVariableAdapter } from '../adhoc/adapter';
import { createConstantVariableAdapter } from '../constant/adapter';
import { createDataSourceVariableAdapter } from '../datasource/adapter';
import { createDataSourceOptions } from '../datasource/reducer';
import { cleanEditorState } from '../editor/reducer';
import { cleanPickerState } from '../pickers/OptionsPicker/reducer';
import { setVariableQueryRunner } from '../query/VariableQueryRunner';
import { createQueryVariableAdapter } from '../query/adapter';
import { adHocBuilder, constantBuilder, datasourceBuilder, queryBuilder } from '../shared/testing/builders';
import { TransactionStatus, VariableModel } from '../types';
import { toVariablePayload } from '../utils';

import { initVariablesTransaction } from './actions';
import { getPreloadedState, getRootReducer, RootReducerType } from './helpers';
import { toKeyedAction } from './keyedVariablesReducer';
import {
  addVariable,
  changeVariableProp,
  setCurrentVariableValue,
  variableStateCompleted,
  variableStateFetching,
  variableStateNotStarted,
} from './sharedReducer';
import {
  initialTransactionState,
  variablesClearTransaction,
  variablesCompleteTransaction,
  variablesInitTransaction,
} from './transactionReducer';
import { cleanVariables } from './variablesReducer';

variableAdapters.setInit(() => [
  createQueryVariableAdapter(),
  createConstantVariableAdapter(),
  createAdHocVariableAdapter(),
  createDataSourceVariableAdapter(),
]);

function getTestContext(variables?: VariableModel[]) {
  const key = 'key';
  const constant = constantBuilder().withId('constant').withName('constant').build();
  const templating = { list: variables ?? [constant] };
  const getInstanceSettingsMock = jest.fn().mockReturnValue(undefined);
  setDataSourceSrv({
    get: jest.fn().mockResolvedValue({}),
    getList: jest.fn().mockReturnValue([]),
    getInstanceSettings: getInstanceSettingsMock,
    reload: jest.fn(),
  });
  const variableQueryRunner: any = {
    cancelRequest: jest.fn(),
    queueRequest: jest.fn(),
    getResponse: () => toAsyncOfResult({ state: LoadingState.Done, identifier: { type: 'query', id: 'query' } }),
    destroy: jest.fn(),
  };
  setVariableQueryRunner(variableQueryRunner);

  const dashboard: any = { title: 'Some dash', uid: key, templating };

  return { constant, getInstanceSettingsMock, templating, key, dashboard };
}

describe('initVariablesTransaction', () => {
  describe('when called and the previous dashboard has completed', () => {
    it('then correct actions are dispatched', async () => {
      const { constant, key, dashboard } = getTestContext();
      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenAsyncActionIsDispatched(initVariablesTransaction(key, dashboard));

      tester.thenDispatchedActionsPredicateShouldEqual((dispatchedActions) => {
        expect(dispatchedActions[0]).toEqual(toKeyedAction(key, variablesInitTransaction({ uid: key })));
        expect(dispatchedActions[1].payload.action.type).toEqual(addVariable.type);
        expect(dispatchedActions[1].payload.action.payload.id).toEqual('__dashboard');
        expect(dispatchedActions[2].payload.action.type).toEqual(addVariable.type);
        expect(dispatchedActions[2].payload.action.payload.id).toEqual('__org');
        expect(dispatchedActions[3].payload.action.type).toEqual(addVariable.type);
        expect(dispatchedActions[3].payload.action.payload.id).toEqual('__user');
        expect(dispatchedActions[4]).toEqual(
          toKeyedAction(key, addVariable(toVariablePayload(constant, { global: false, index: 0, model: constant })))
        );
        expect(dispatchedActions[5]).toEqual(toKeyedAction(key, variableStateNotStarted(toVariablePayload(constant))));
        expect(dispatchedActions[6]).toEqual(toKeyedAction(key, variableStateCompleted(toVariablePayload(constant))));

        expect(dispatchedActions[7]).toEqual(toKeyedAction(key, variablesCompleteTransaction({ uid: key })));
        return dispatchedActions.length === 8;
      });
    });

    describe('and there are variables that have data source that need to be migrated', () => {
      it('then correct actions are dispatched', async () => {
        const legacyDs = '${ds}' as unknown as DataSourceRef;
        const ds = datasourceBuilder().withId('ds').withRootStateKey('key').withName('ds').withQuery('prom').build();
        const query = queryBuilder()
          .withId('query')
          .withRootStateKey('key')
          .withName('query')
          .withDatasource(legacyDs)
          .build();
        const adhoc = adHocBuilder()
          .withId('adhoc')
          .withRootStateKey('key')
          .withName('adhoc')
          .withDatasource(legacyDs)
          .build();
        const { key, dashboard } = getTestContext([ds, query, adhoc]);
        const tester = await reduxTester<RootReducerType>()
          .givenRootReducer(getRootReducer())
          .whenAsyncActionIsDispatched(initVariablesTransaction(key, dashboard));

        tester.thenDispatchedActionsPredicateShouldEqual((dispatchedActions) => {
          expect(dispatchedActions[0]).toEqual(toKeyedAction(key, variablesInitTransaction({ uid: key })));
          expect(dispatchedActions[1].payload.action.type).toEqual(addVariable.type);
          expect(dispatchedActions[1].payload.action.payload.id).toEqual('__dashboard');
          expect(dispatchedActions[2].payload.action.type).toEqual(addVariable.type);
          expect(dispatchedActions[2].payload.action.payload.id).toEqual('__org');
          expect(dispatchedActions[3].payload.action.type).toEqual(addVariable.type);
          expect(dispatchedActions[3].payload.action.payload.id).toEqual('__user');
          expect(dispatchedActions[4]).toEqual(
            toKeyedAction(key, addVariable(toVariablePayload(ds, { global: false, index: 0, model: ds })))
          );
          expect(dispatchedActions[5]).toEqual(
            toKeyedAction(key, addVariable(toVariablePayload(query, { global: false, index: 1, model: query })))
          );
          expect(dispatchedActions[6]).toEqual(
            toKeyedAction(key, addVariable(toVariablePayload(adhoc, { global: false, index: 2, model: adhoc })))
          );
          expect(dispatchedActions[7]).toEqual(toKeyedAction(key, variableStateNotStarted(toVariablePayload(ds))));
          expect(dispatchedActions[8]).toEqual(toKeyedAction(key, variableStateNotStarted(toVariablePayload(query))));
          expect(dispatchedActions[9]).toEqual(toKeyedAction(key, variableStateNotStarted(toVariablePayload(adhoc))));
          expect(dispatchedActions[10]).toEqual(
            toKeyedAction(
              key,
              changeVariableProp(toVariablePayload(query, { propName: 'datasource', propValue: { uid: '${ds}' } }))
            )
          );
          expect(dispatchedActions[11]).toEqual(
            toKeyedAction(
              key,
              changeVariableProp(toVariablePayload(adhoc, { propName: 'datasource', propValue: { uid: '${ds}' } }))
            )
          );
          expect(dispatchedActions[12]).toEqual(toKeyedAction(key, variableStateFetching(toVariablePayload(ds))));
          expect(dispatchedActions[13]).toEqual(toKeyedAction(key, variableStateCompleted(toVariablePayload(adhoc))));
          expect(dispatchedActions[14]).toEqual(
            toKeyedAction(key, createDataSourceOptions(toVariablePayload(ds, { sources: [], regex: undefined })))
          );
          expect(dispatchedActions[15]).toEqual(
            toKeyedAction(
              key,
              setCurrentVariableValue(
                toVariablePayload(ds, { option: { selected: false, text: 'No data sources found', value: '' } })
              )
            )
          );
          expect(dispatchedActions[16]).toEqual(toKeyedAction(key, variableStateCompleted(toVariablePayload(ds))));
          expect(dispatchedActions[17]).toEqual(toKeyedAction(key, variableStateFetching(toVariablePayload(query))));
          expect(dispatchedActions[18]).toEqual(toKeyedAction(key, variableStateCompleted(toVariablePayload(query))));
          expect(dispatchedActions[19]).toEqual(toKeyedAction(key, variablesCompleteTransaction({ uid: key })));

          return dispatchedActions.length === 20;
        });
      });
    });
  });

  describe('when called and the previous dashboard is still processing variables', () => {
    it('then correct actions are dispatched', async () => {
      const { constant, key, dashboard } = getTestContext();
      const transactionState = { ...initialTransactionState, uid: 'previous-uid', status: TransactionStatus.Fetching };
      const preloadedState = getPreloadedState(key, { transaction: transactionState });

      const tester = await reduxTester<RootReducerType>({ preloadedState })
        .givenRootReducer(getRootReducer())
        .whenAsyncActionIsDispatched(initVariablesTransaction(key, dashboard));

      tester.thenDispatchedActionsPredicateShouldEqual((dispatchedActions) => {
        expect(dispatchedActions[0]).toEqual(toKeyedAction(key, cleanVariables()));
        expect(dispatchedActions[1]).toEqual(toKeyedAction(key, cleanEditorState()));
        expect(dispatchedActions[2]).toEqual(toKeyedAction(key, cleanPickerState()));
        expect(dispatchedActions[3]).toEqual(toKeyedAction(key, variablesClearTransaction()));
        expect(dispatchedActions[4]).toEqual(toKeyedAction(key, variablesInitTransaction({ uid: key })));
        expect(dispatchedActions[5].payload.action.type).toEqual(addVariable.type);
        expect(dispatchedActions[5].payload.action.payload.id).toEqual('__dashboard');
        expect(dispatchedActions[6].payload.action.type).toEqual(addVariable.type);
        expect(dispatchedActions[6].payload.action.payload.id).toEqual('__org');
        expect(dispatchedActions[7].payload.action.type).toEqual(addVariable.type);
        expect(dispatchedActions[7].payload.action.payload.id).toEqual('__user');
        expect(dispatchedActions[8]).toEqual(
          toKeyedAction(key, addVariable(toVariablePayload(constant, { global: false, index: 0, model: constant })))
        );
        expect(dispatchedActions[9]).toEqual(toKeyedAction(key, variableStateNotStarted(toVariablePayload(constant))));
        expect(dispatchedActions[10]).toEqual(toKeyedAction(key, variableStateCompleted(toVariablePayload(constant))));
        expect(dispatchedActions[11]).toEqual(toKeyedAction(key, variablesCompleteTransaction({ uid: key })));
        return dispatchedActions.length === 12;
      });
    });
  });
});
