import { customBuilder, queryBuilder } from '../shared/testing/builders';
import { VariableSupportType } from '@grafana/data';
import { toVariableIdentifier } from './types';
import { upgradeLegacyQueries } from './actions';
import { changeVariableProp } from './sharedReducer';
import { thunkTester } from '../../../../test/core/thunk/thunkTester';
import { TransactionStatus, VariableModel } from '../types';

interface Args {
  query?: any;
  variable?: VariableModel;
  datasource?: any;
  transactionStatus?: TransactionStatus;
}
function getTestContext({
  query = '',
  variable,
  datasource,
  transactionStatus = TransactionStatus.Fetching,
}: Args = {}) {
  variable =
    variable ??
    queryBuilder()
      .withId('query')
      .withName('query')
      .withQuery(query)
      .withDatasource({ uid: 'test-data', type: 'test-data' })
      .build();
  const state = {
    templating: {
      transaction: { status: transactionStatus },
      variables: {
        [variable.id]: variable,
      },
    },
  };
  datasource = datasource ?? {
    name: 'TestData',
    metricFindQuery: () => undefined,
    variables: { getType: () => VariableSupportType.Standard, toDataQuery: () => undefined },
  };
  const get = jest.fn().mockResolvedValue(datasource);
  const getDatasourceSrv = jest.fn().mockReturnValue({ get });
  const identifier = toVariableIdentifier(variable);

  return { state, get, getDatasourceSrv, identifier };
}

describe('upgradeLegacyQueries', () => {
  describe('when called with a query variable for a standard variable supported data source that has not been upgraded', () => {
    it('then it should dispatch changeVariableProp', async () => {
      const { state, identifier, get, getDatasourceSrv } = getTestContext({ query: '*' });

      const dispatchedActions = await thunkTester(state)
        .givenThunk(upgradeLegacyQueries)
        .whenThunkIsDispatched(identifier, getDatasourceSrv);

      expect(dispatchedActions).toEqual([
        changeVariableProp({
          type: 'query',
          id: 'query',
          data: {
            propName: 'query',
            propValue: {
              refId: 'TestData-query-Variable-Query',
              query: '*',
            },
          },
        }),
      ]);
      expect(get).toHaveBeenCalledTimes(1);
      expect(get).toHaveBeenCalledWith({ uid: 'test-data', type: 'test-data' });
    });

    describe('but there is no ongoing transaction', () => {
      it('then it should not dispatch changeVariableProp', async () => {
        const { state, identifier, get, getDatasourceSrv } = getTestContext({
          query: '*',
          transactionStatus: TransactionStatus.NotStarted,
        });

        const dispatchedActions = await thunkTester(state)
          .givenThunk(upgradeLegacyQueries)
          .whenThunkIsDispatched(identifier, getDatasourceSrv);

        expect(dispatchedActions).toEqual([]);
        expect(get).toHaveBeenCalledTimes(0);
      });
    });
  });

  describe('when called with a query variable for a standard variable supported data source that has been upgraded', () => {
    it('then it should not dispatch any actions', async () => {
      const { state, identifier, get, getDatasourceSrv } = getTestContext({ query: { refId: 'A' } });

      const dispatchedActions = await thunkTester(state)
        .givenThunk(upgradeLegacyQueries)
        .whenThunkIsDispatched(identifier, getDatasourceSrv);

      expect(dispatchedActions).toEqual([]);
      expect(get).toHaveBeenCalledTimes(1);
      expect(get).toHaveBeenCalledWith({ uid: 'test-data', type: 'test-data' });
    });
  });

  describe('when called with a query variable for a legacy variable supported data source', () => {
    it('then it should not dispatch any actions', async () => {
      const datasource = {
        name: 'TestData',
        metricFindQuery: () => undefined,
      };
      const { state, identifier, get, getDatasourceSrv } = getTestContext({ datasource });

      const dispatchedActions = await thunkTester(state)
        .givenThunk(upgradeLegacyQueries)
        .whenThunkIsDispatched(identifier, getDatasourceSrv);

      expect(dispatchedActions).toEqual([]);
      expect(get).toHaveBeenCalledTimes(1);
      expect(get).toHaveBeenCalledWith({ uid: 'test-data', type: 'test-data' });
    });
  });

  describe('when called with a query variable for a custom variable supported data source', () => {
    it('then it should not dispatch any actions', async () => {
      const datasource = {
        name: 'TestData',
        metricFindQuery: () => undefined,
        variables: { getType: () => VariableSupportType.Custom, query: () => undefined, editor: {} },
      };
      const { state, identifier, get, getDatasourceSrv } = getTestContext({ datasource });

      const dispatchedActions = await thunkTester(state)
        .givenThunk(upgradeLegacyQueries)
        .whenThunkIsDispatched(identifier, getDatasourceSrv);

      expect(dispatchedActions).toEqual([]);
      expect(get).toHaveBeenCalledTimes(1);
      expect(get).toHaveBeenCalledWith({ uid: 'test-data', type: 'test-data' });
    });
  });

  describe('when called with a query variable for a datasource variable supported data source', () => {
    it('then it should not dispatch any actions', async () => {
      const datasource = {
        name: 'TestData',
        metricFindQuery: () => undefined,
        variables: { getType: () => VariableSupportType.Datasource },
      };
      const { state, identifier, get, getDatasourceSrv } = getTestContext({ datasource });

      const dispatchedActions = await thunkTester(state)
        .givenThunk(upgradeLegacyQueries)
        .whenThunkIsDispatched(identifier, getDatasourceSrv);

      expect(dispatchedActions).toEqual([]);
      expect(get).toHaveBeenCalledTimes(1);
      expect(get).toHaveBeenCalledWith({ uid: 'test-data', type: 'test-data' });
    });
  });

  describe('when called with a custom variable', () => {
    it('then it should not dispatch any actions', async () => {
      const variable = customBuilder().withId('custom').withName('custom').build();
      const { state, identifier, get, getDatasourceSrv } = getTestContext({ variable });

      const dispatchedActions = await thunkTester(state)
        .givenThunk(upgradeLegacyQueries)
        .whenThunkIsDispatched(identifier, getDatasourceSrv);

      expect(dispatchedActions).toEqual([]);
      expect(get).toHaveBeenCalledTimes(0);
    });
  });
});
