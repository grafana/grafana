import { UrlQueryMap, VariableRefresh } from '@grafana/data';
import { setDataSourceSrv } from '@grafana/runtime';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { DatasourceSrv } from 'app/features/plugins/datasource_srv';

import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { variableAdapters } from '../adapters';
import { createCustomVariableAdapter } from '../custom/adapter';
import { createCustomOptionsFromQuery } from '../custom/reducer';
import { setVariableQueryRunner, VariableQueryRunner } from '../query/VariableQueryRunner';
import { createQueryVariableAdapter } from '../query/adapter';
import { updateVariableOptions } from '../query/reducer';
import { customBuilder, queryBuilder } from '../shared/testing/builders';
import { toKeyedVariableIdentifier, toVariablePayload } from '../utils';

import { initDashboardTemplating, processVariable } from './actions';
import { getTemplatingRootReducer, TemplatingReducerType } from './helpers';
import { toKeyedAction } from './keyedVariablesReducer';
import { setCurrentVariableValue, variableStateCompleted, variableStateFetching } from './sharedReducer';
import { variablesInitTransaction } from './transactionReducer';

jest.mock('app/features/dashboard/services/TimeSrv', () => ({
  getTimeSrv: jest.fn().mockReturnValue({
    timeRange: jest.fn().mockReturnValue({
      from: '2001-01-01T01:00:00.000Z',
      to: '2001-01-01T02:00:00.000Z',
      raw: {
        from: 'now-1h',
        to: 'now',
      },
    }),
  }),
}));

setDataSourceSrv({
  get: jest.fn().mockResolvedValue({
    metricFindQuery: jest.fn().mockImplementation((query, options) => {
      if (query === '$custom.*') {
        return Promise.resolve([
          { value: 'AA', text: 'AA' },
          { value: 'AB', text: 'AB' },
          { value: 'AC', text: 'AC' },
        ]);
      }

      if (query === '$custom.$queryDependsOnCustom.*') {
        return Promise.resolve([
          { value: 'AAA', text: 'AAA' },
          { value: 'AAB', text: 'AAB' },
          { value: 'AAC', text: 'AAC' },
        ]);
      }

      if (query === '*') {
        return Promise.resolve([
          { value: 'A', text: 'A' },
          { value: 'B', text: 'B' },
          { value: 'C', text: 'C' },
        ]);
      }

      return Promise.resolve([]);
    }),
  }),
} as unknown as DatasourceSrv);

variableAdapters.setInit(() => [createCustomVariableAdapter(), createQueryVariableAdapter()]);

describe('processVariable', () => {
  // these following processVariable tests will test the following base setup
  // custom doesn't depend on any other variable
  // queryDependsOnCustom depends on custom
  // queryNoDepends doesn't depend on any other variable
  const key = 'key';
  const getTestContext = () => {
    const custom = customBuilder()
      .withId('custom')
      .withRootStateKey(key)
      .withName('custom')
      .withQuery('A,B,C')
      .withOptions('A', 'B', 'C')
      .withCurrent('A')
      .build();

    const queryDependsOnCustom = queryBuilder()
      .withId('queryDependsOnCustom')
      .withRootStateKey(key)
      .withName('queryDependsOnCustom')
      .withQuery('$custom.*')
      .withOptions('AA', 'AB', 'AC')
      .withCurrent('AA')
      .build();

    const queryNoDepends = queryBuilder()
      .withId('queryNoDepends')
      .withRootStateKey(key)
      .withName('queryNoDepends')
      .withQuery('*')
      .withOptions('A', 'B', 'C')
      .withCurrent('A')
      .build();

    const list = [custom, queryDependsOnCustom, queryNoDepends];
    const dashboard = { templating: { list } } as DashboardModel;
    setVariableQueryRunner(new VariableQueryRunner());

    return {
      key,
      custom,
      queryDependsOnCustom,
      queryNoDepends,
      dashboard,
    };
  };

  // testing processVariable for the custom variable from case described above
  describe('when processVariable is dispatched for a custom variable without dependencies', () => {
    describe('and queryParams does not match variable', () => {
      it('then correct actions are dispatched', async () => {
        const { key, dashboard, custom } = getTestContext();
        const queryParams: UrlQueryMap = {};
        const tester = await reduxTester<TemplatingReducerType>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(toKeyedAction(key, variablesInitTransaction({ uid: key })))
          .whenActionIsDispatched(initDashboardTemplating(key, dashboard))
          .whenAsyncActionIsDispatched(processVariable(toKeyedVariableIdentifier(custom), queryParams), true);

        await tester.thenDispatchedActionsPredicateShouldEqual((dispatchedActions) => {
          expect(dispatchedActions.length).toEqual(4);

          expect(dispatchedActions[0]).toEqual(toKeyedAction(key, variableStateFetching(toVariablePayload(custom))));
          expect(dispatchedActions[1]).toEqual(
            toKeyedAction(key, createCustomOptionsFromQuery(toVariablePayload(custom, 'A,B,C')))
          );
          expect(dispatchedActions[2].type).toEqual('templating/keyed/shared/setCurrentVariableValue');
          expect(dispatchedActions[3]).toEqual(toKeyedAction(key, variableStateCompleted(toVariablePayload(custom))));

          return true;
        });
      });
    });

    describe('and queryParams does match variable', () => {
      it('then correct actions are dispatched', async () => {
        const { key, dashboard, custom } = getTestContext();
        const queryParams: UrlQueryMap = { 'var-custom': 'B' };
        const tester = await reduxTester<TemplatingReducerType>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(toKeyedAction(key, variablesInitTransaction({ uid: key })))
          .whenActionIsDispatched(initDashboardTemplating(key, dashboard))
          .whenAsyncActionIsDispatched(processVariable(toKeyedVariableIdentifier(custom), queryParams), true);

        await tester.thenDispatchedActionsShouldEqual(
          toKeyedAction(key, variableStateFetching(toVariablePayload({ type: 'custom', id: 'custom' }))),
          toKeyedAction(
            key,
            createCustomOptionsFromQuery(toVariablePayload({ type: 'custom', id: 'custom' }, 'A,B,C'))
          ),
          toKeyedAction(
            key,
            setCurrentVariableValue(
              toVariablePayload(
                { type: 'custom', id: 'custom' },
                { option: { text: 'A', value: 'A', selected: false } }
              )
            )
          ),
          toKeyedAction(key, variableStateCompleted(toVariablePayload(custom))),
          toKeyedAction(
            key,
            setCurrentVariableValue(
              toVariablePayload(
                { type: 'custom', id: 'custom' },
                { option: { text: 'B', value: 'B', selected: false } }
              )
            )
          )
        );
      });
    });
  });

  // testing processVariable for the queryNoDepends variable from case described above
  describe('when processVariable is dispatched for a query variable without dependencies', () => {
    describe('and queryParams does not match variable', () => {
      const queryParams: UrlQueryMap = {};

      describe('and refresh is VariableRefresh.never', () => {
        const refresh = VariableRefresh.never;
        it('then correct actions are dispatched', async () => {
          const { dashboard, key, queryNoDepends } = getTestContext();
          queryNoDepends.refresh = refresh;
          const tester = await reduxTester<TemplatingReducerType>()
            .givenRootReducer(getTemplatingRootReducer())
            .whenActionIsDispatched(toKeyedAction(key, variablesInitTransaction({ uid: key })))
            .whenActionIsDispatched(initDashboardTemplating(key, dashboard))
            .whenAsyncActionIsDispatched(processVariable(toKeyedVariableIdentifier(queryNoDepends), queryParams), true);

          await tester.thenDispatchedActionsShouldEqual(
            toKeyedAction(key, variableStateCompleted(toVariablePayload(queryNoDepends)))
          );
        });
      });

      it.each`
        refresh
        ${VariableRefresh.onDashboardLoad}
        ${VariableRefresh.onTimeRangeChanged}
      `('and refresh is $refresh then correct actions are dispatched', async ({ refresh }) => {
        const { dashboard, key, queryNoDepends } = getTestContext();
        queryNoDepends.refresh = refresh;
        const tester = await reduxTester<TemplatingReducerType>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(toKeyedAction(key, variablesInitTransaction({ uid: key })))
          .whenActionIsDispatched(initDashboardTemplating(key, dashboard))
          .whenAsyncActionIsDispatched(processVariable(toKeyedVariableIdentifier(queryNoDepends), queryParams), true);

        await tester.thenDispatchedActionsShouldEqual(
          toKeyedAction(key, variableStateFetching(toVariablePayload({ type: 'query', id: 'queryNoDepends' }))),
          toKeyedAction(
            key,
            updateVariableOptions(
              toVariablePayload(
                { type: 'query', id: 'queryNoDepends' },
                {
                  results: [
                    { value: 'A', text: 'A' },
                    { value: 'B', text: 'B' },
                    { value: 'C', text: 'C' },
                  ],
                  templatedRegex: '',
                }
              )
            )
          ),
          toKeyedAction(
            key,
            setCurrentVariableValue(
              toVariablePayload(
                { type: 'query', id: 'queryNoDepends' },
                { option: { text: 'A', value: 'A', selected: false } }
              )
            )
          ),
          toKeyedAction(key, variableStateCompleted(toVariablePayload({ type: 'query', id: 'queryNoDepends' })))
        );
      });
    });

    describe('and queryParams does match variable', () => {
      const queryParams: UrlQueryMap = { 'var-queryNoDepends': 'B' };

      describe('and refresh is VariableRefresh.never', () => {
        const refresh = VariableRefresh.never;
        it('then correct actions are dispatched', async () => {
          const { dashboard, key, queryNoDepends } = getTestContext();
          queryNoDepends.refresh = refresh;
          const tester = await reduxTester<TemplatingReducerType>()
            .givenRootReducer(getTemplatingRootReducer())
            .whenActionIsDispatched(toKeyedAction(key, variablesInitTransaction({ uid: key })))
            .whenActionIsDispatched(initDashboardTemplating(key, dashboard))
            .whenAsyncActionIsDispatched(processVariable(toKeyedVariableIdentifier(queryNoDepends), queryParams), true);

          await tester.thenDispatchedActionsShouldEqual(
            toKeyedAction(
              key,
              setCurrentVariableValue(
                toVariablePayload(
                  { type: 'query', id: 'queryNoDepends' },
                  { option: { text: 'B', value: 'B', selected: false } }
                )
              )
            ),
            toKeyedAction(key, variableStateCompleted(toVariablePayload({ type: 'query', id: 'queryNoDepends' })))
          );
        });
      });

      it.each`
        refresh
        ${VariableRefresh.onDashboardLoad}
        ${VariableRefresh.onTimeRangeChanged}
      `('and refresh is $refresh then correct actions are dispatched', async ({ refresh }) => {
        const { dashboard, key, queryNoDepends } = getTestContext();
        queryNoDepends.refresh = refresh;
        const tester = await reduxTester<TemplatingReducerType>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(toKeyedAction(key, variablesInitTransaction({ uid: key })))
          .whenActionIsDispatched(initDashboardTemplating(key, dashboard))
          .whenAsyncActionIsDispatched(processVariable(toKeyedVariableIdentifier(queryNoDepends), queryParams), true);

        await tester.thenDispatchedActionsShouldEqual(
          toKeyedAction(key, variableStateFetching(toVariablePayload({ type: 'query', id: 'queryNoDepends' }))),
          toKeyedAction(
            key,
            updateVariableOptions(
              toVariablePayload(
                { type: 'query', id: 'queryNoDepends' },
                {
                  results: [
                    { value: 'A', text: 'A' },
                    { value: 'B', text: 'B' },
                    { value: 'C', text: 'C' },
                  ],
                  templatedRegex: '',
                }
              )
            )
          ),
          toKeyedAction(
            key,
            setCurrentVariableValue(
              toVariablePayload(
                { type: 'query', id: 'queryNoDepends' },
                { option: { text: 'A', value: 'A', selected: false } }
              )
            )
          ),
          toKeyedAction(key, variableStateCompleted(toVariablePayload({ type: 'query', id: 'queryNoDepends' }))),
          toKeyedAction(
            key,
            setCurrentVariableValue(
              toVariablePayload(
                { type: 'query', id: 'queryNoDepends' },
                { option: { text: 'B', value: 'B', selected: false } }
              )
            )
          )
        );
      });
    });
  });

  // testing processVariable for the queryDependsOnCustom variable from case described above
  describe('when processVariable is dispatched for a query variable with one dependency', () => {
    describe('and queryParams does not match variable', () => {
      const queryParams: UrlQueryMap = {};

      describe('and refresh is VariableRefresh.never', () => {
        const refresh = VariableRefresh.never;
        it('then correct actions are dispatched', async () => {
          const { key, dashboard, custom, queryDependsOnCustom } = getTestContext();
          queryDependsOnCustom.refresh = refresh;
          const customProcessed = await reduxTester<TemplatingReducerType>()
            .givenRootReducer(getTemplatingRootReducer())
            .whenActionIsDispatched(toKeyedAction(key, variablesInitTransaction({ uid: key })))
            .whenActionIsDispatched(initDashboardTemplating(key, dashboard))
            .whenAsyncActionIsDispatched(processVariable(toKeyedVariableIdentifier(custom), queryParams)); // Need to process this dependency otherwise we never complete the promise chain

          const tester = await customProcessed.whenAsyncActionIsDispatched(
            processVariable(toKeyedVariableIdentifier(queryDependsOnCustom), queryParams),
            true
          );

          await tester.thenDispatchedActionsShouldEqual(
            toKeyedAction(key, variableStateCompleted(toVariablePayload({ type: 'query', id: 'queryDependsOnCustom' })))
          );
        });
      });

      it.each`
        refresh
        ${VariableRefresh.onDashboardLoad}
        ${VariableRefresh.onTimeRangeChanged}
      `('and refresh is $refresh then correct actions are dispatched', async ({ refresh }) => {
        const { key, dashboard, custom, queryDependsOnCustom } = getTestContext();
        queryDependsOnCustom.refresh = refresh;
        const customProcessed = await reduxTester<TemplatingReducerType>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(toKeyedAction(key, variablesInitTransaction({ uid: key })))
          .whenActionIsDispatched(initDashboardTemplating(key, dashboard))
          .whenAsyncActionIsDispatched(processVariable(toKeyedVariableIdentifier(custom), queryParams)); // Need to process this dependency otherwise we never complete the promise chain

        const tester = await customProcessed.whenAsyncActionIsDispatched(
          processVariable(toKeyedVariableIdentifier(queryDependsOnCustom), queryParams),
          true
        );

        await tester.thenDispatchedActionsShouldEqual(
          toKeyedAction(key, variableStateFetching(toVariablePayload({ type: 'query', id: 'queryDependsOnCustom' }))),
          toKeyedAction(
            key,
            updateVariableOptions(
              toVariablePayload(
                { type: 'query', id: 'queryDependsOnCustom' },
                {
                  results: [
                    { value: 'AA', text: 'AA' },
                    { value: 'AB', text: 'AB' },
                    { value: 'AC', text: 'AC' },
                  ],
                  templatedRegex: '',
                }
              )
            )
          ),
          toKeyedAction(
            key,
            setCurrentVariableValue(
              toVariablePayload(
                { type: 'query', id: 'queryDependsOnCustom' },
                { option: { text: 'AA', value: 'AA', selected: false } }
              )
            )
          ),
          toKeyedAction(key, variableStateCompleted(toVariablePayload({ type: 'query', id: 'queryDependsOnCustom' })))
        );
      });
    });

    describe('and queryParams does match variable', () => {
      const queryParams: UrlQueryMap = { 'var-queryDependsOnCustom': 'AB' };

      describe('and refresh is VariableRefresh.never', () => {
        const refresh = VariableRefresh.never;
        it('then correct actions are dispatched', async () => {
          const { key, dashboard, custom, queryDependsOnCustom } = getTestContext();
          queryDependsOnCustom.refresh = refresh;
          const customProcessed = await reduxTester<TemplatingReducerType>()
            .givenRootReducer(getTemplatingRootReducer())
            .whenActionIsDispatched(toKeyedAction(key, variablesInitTransaction({ uid: key })))
            .whenActionIsDispatched(initDashboardTemplating(key, dashboard))
            .whenAsyncActionIsDispatched(processVariable(toKeyedVariableIdentifier(custom), queryParams)); // Need to process this dependency otherwise we never complete the promise chain

          const tester = await customProcessed.whenAsyncActionIsDispatched(
            processVariable(toKeyedVariableIdentifier(queryDependsOnCustom), queryParams),
            true
          );

          await tester.thenDispatchedActionsShouldEqual(
            toKeyedAction(
              key,
              setCurrentVariableValue(
                toVariablePayload(
                  { type: 'query', id: 'queryDependsOnCustom' },
                  { option: { text: 'AB', value: 'AB', selected: false } }
                )
              )
            ),
            toKeyedAction(key, variableStateCompleted(toVariablePayload({ type: 'query', id: 'queryDependsOnCustom' })))
          );
        });
      });

      it.each`
        refresh
        ${VariableRefresh.onDashboardLoad}
        ${VariableRefresh.onTimeRangeChanged}
      `('and refresh is $refresh then correct actions are dispatched', async ({ refresh }) => {
        const { key, dashboard, custom, queryDependsOnCustom } = getTestContext();
        queryDependsOnCustom.refresh = refresh;
        const customProcessed = await reduxTester<TemplatingReducerType>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(toKeyedAction(key, variablesInitTransaction({ uid: key })))
          .whenActionIsDispatched(initDashboardTemplating(key, dashboard))
          .whenAsyncActionIsDispatched(processVariable(toKeyedVariableIdentifier(custom), queryParams)); // Need to process this dependency otherwise we never complete the promise chain

        const tester = await customProcessed.whenAsyncActionIsDispatched(
          processVariable(toKeyedVariableIdentifier(queryDependsOnCustom), queryParams),
          true
        );

        await tester.thenDispatchedActionsShouldEqual(
          toKeyedAction(key, variableStateFetching(toVariablePayload({ type: 'query', id: 'queryDependsOnCustom' }))),
          toKeyedAction(
            key,
            updateVariableOptions(
              toVariablePayload(
                { type: 'query', id: 'queryDependsOnCustom' },
                {
                  results: [
                    { value: 'AA', text: 'AA' },
                    { value: 'AB', text: 'AB' },
                    { value: 'AC', text: 'AC' },
                  ],
                  templatedRegex: '',
                }
              )
            )
          ),
          toKeyedAction(
            key,
            setCurrentVariableValue(
              toVariablePayload(
                { type: 'query', id: 'queryDependsOnCustom' },
                { option: { text: 'AA', value: 'AA', selected: false } }
              )
            )
          ),
          toKeyedAction(key, variableStateCompleted(toVariablePayload({ type: 'query', id: 'queryDependsOnCustom' }))),
          toKeyedAction(
            key,
            setCurrentVariableValue(
              toVariablePayload(
                { type: 'query', id: 'queryDependsOnCustom' },
                { option: { text: 'AB', value: 'AB', selected: false } }
              )
            )
          )
        );
      });
    });
  });
});
