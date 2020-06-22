import { UrlQueryMap } from '@grafana/data';

import { getTemplatingRootReducer } from './helpers';
import { variableAdapters } from '../adapters';
import { createQueryVariableAdapter } from '../query/adapter';
import { createCustomVariableAdapter } from '../custom/adapter';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { TemplatingState } from 'app/features/variables/state/reducers';
import { initDashboardTemplating, processVariable } from './actions';
import { resolveInitLock, setCurrentVariableValue } from './sharedReducer';
import { toVariableIdentifier, toVariablePayload } from './types';
import { VariableRefresh } from '../types';
import { updateVariableOptions } from '../query/reducer';
import { customBuilder, queryBuilder } from '../shared/testing/builders';

'../shared/testing/builders';

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

jest.mock('app/features/plugins/datasource_srv', () => ({
  getDatasourceSrv: () => ({
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
  }),
}));

variableAdapters.setInit(() => [createCustomVariableAdapter(), createQueryVariableAdapter()]);

describe('processVariable', () => {
  // these following processVariable tests will test the following base setup
  // custom doesn't depend on any other variable
  // queryDependsOnCustom depends on custom
  // queryNoDepends doesn't depend on any other variable
  const getAndSetupProcessVariableContext = () => {
    const custom = customBuilder()
      .withId('custom')
      .withName('custom')
      .withQuery('A,B,C')
      .withOptions('A', 'B', 'C')
      .withCurrent('A')
      .build();

    const queryDependsOnCustom = queryBuilder()
      .withId('queryDependsOnCustom')
      .withName('queryDependsOnCustom')
      .withQuery('$custom.*')
      .withOptions('AA', 'AB', 'AC')
      .withCurrent('AA')
      .build();

    const queryNoDepends = queryBuilder()
      .withId('queryNoDepends')
      .withName('queryNoDepends')
      .withQuery('*')
      .withOptions('A', 'B', 'C')
      .withCurrent('A')
      .build();

    const list = [custom, queryDependsOnCustom, queryNoDepends];

    return {
      custom,
      queryDependsOnCustom,
      queryNoDepends,
      list,
    };
  };

  // testing processVariable for the custom variable from case described above
  describe('when processVariable is dispatched for a custom variable without dependencies', () => {
    describe('and queryParams does not match variable', () => {
      it('then correct actions are dispatched', async () => {
        const { list, custom } = getAndSetupProcessVariableContext();
        const queryParams: UrlQueryMap = {};
        const tester = await reduxTester<{ templating: TemplatingState }>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(initDashboardTemplating(list))
          .whenAsyncActionIsDispatched(processVariable(toVariableIdentifier(custom), queryParams), true);

        await tester.thenDispatchedActionsShouldEqual(
          resolveInitLock(toVariablePayload({ type: 'custom', id: 'custom' }))
        );
      });
    });

    describe('and queryParams does match variable', () => {
      it('then correct actions are dispatched', async () => {
        const { list, custom } = getAndSetupProcessVariableContext();
        const queryParams: UrlQueryMap = { 'var-custom': 'B' };
        const tester = await reduxTester<{ templating: TemplatingState }>()
          .givenRootReducer(getTemplatingRootReducer())
          .whenActionIsDispatched(initDashboardTemplating(list))
          .whenAsyncActionIsDispatched(processVariable(toVariableIdentifier(custom), queryParams), true);

        await tester.thenDispatchedActionsShouldEqual(
          setCurrentVariableValue(
            toVariablePayload({ type: 'custom', id: 'custom' }, { option: { text: 'B', value: 'B', selected: false } })
          ),
          resolveInitLock(toVariablePayload({ type: 'custom', id: 'custom' }))
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
          const { list, queryNoDepends } = getAndSetupProcessVariableContext();
          queryNoDepends.refresh = refresh;
          const tester = await reduxTester<{ templating: TemplatingState }>()
            .givenRootReducer(getTemplatingRootReducer())
            .whenActionIsDispatched(initDashboardTemplating(list))
            .whenAsyncActionIsDispatched(processVariable(toVariableIdentifier(queryNoDepends), queryParams), true);

          await tester.thenDispatchedActionsShouldEqual(
            resolveInitLock(toVariablePayload({ type: 'query', id: 'queryNoDepends' }))
          );
        });
      });

      [VariableRefresh.onDashboardLoad, VariableRefresh.onTimeRangeChanged].forEach(refresh => {
        describe(`and refresh is ${refresh}`, () => {
          it('then correct actions are dispatched', async () => {
            const { list, queryNoDepends } = getAndSetupProcessVariableContext();
            queryNoDepends.refresh = refresh;
            const tester = await reduxTester<{ templating: TemplatingState }>()
              .givenRootReducer(getTemplatingRootReducer())
              .whenActionIsDispatched(initDashboardTemplating(list))
              .whenAsyncActionIsDispatched(processVariable(toVariableIdentifier(queryNoDepends), queryParams), true);

            await tester.thenDispatchedActionsShouldEqual(
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
              ),
              setCurrentVariableValue(
                toVariablePayload(
                  { type: 'query', id: 'queryNoDepends' },
                  { option: { text: 'A', value: 'A', selected: false } }
                )
              ),
              resolveInitLock(toVariablePayload({ type: 'query', id: 'queryNoDepends' }))
            );
          });
        });
      });
    });

    describe('and queryParams does match variable', () => {
      const queryParams: UrlQueryMap = { 'var-queryNoDepends': 'B' };

      describe('and refresh is VariableRefresh.never', () => {
        const refresh = VariableRefresh.never;
        it('then correct actions are dispatched', async () => {
          const { list, queryNoDepends } = getAndSetupProcessVariableContext();
          queryNoDepends.refresh = refresh;
          const tester = await reduxTester<{ templating: TemplatingState }>()
            .givenRootReducer(getTemplatingRootReducer())
            .whenActionIsDispatched(initDashboardTemplating(list))
            .whenAsyncActionIsDispatched(processVariable(toVariableIdentifier(queryNoDepends), queryParams), true);

          await tester.thenDispatchedActionsShouldEqual(
            setCurrentVariableValue(
              toVariablePayload(
                { type: 'query', id: 'queryNoDepends' },
                { option: { text: 'B', value: 'B', selected: false } }
              )
            ),
            resolveInitLock(toVariablePayload({ type: 'query', id: 'queryNoDepends' }))
          );
        });
      });

      [VariableRefresh.onDashboardLoad, VariableRefresh.onTimeRangeChanged].forEach(refresh => {
        describe(`and refresh is ${
          refresh === VariableRefresh.onDashboardLoad
            ? 'VariableRefresh.onDashboardLoad'
            : 'VariableRefresh.onTimeRangeChanged'
        }`, () => {
          it('then correct actions are dispatched', async () => {
            const { list, queryNoDepends } = getAndSetupProcessVariableContext();
            queryNoDepends.refresh = refresh;
            const tester = await reduxTester<{ templating: TemplatingState }>()
              .givenRootReducer(getTemplatingRootReducer())
              .whenActionIsDispatched(initDashboardTemplating(list))
              .whenAsyncActionIsDispatched(processVariable(toVariableIdentifier(queryNoDepends), queryParams), true);

            await tester.thenDispatchedActionsShouldEqual(
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
              ),
              setCurrentVariableValue(
                toVariablePayload(
                  { type: 'query', id: 'queryNoDepends' },
                  { option: { text: 'A', value: 'A', selected: false } }
                )
              ),
              setCurrentVariableValue(
                toVariablePayload(
                  { type: 'query', id: 'queryNoDepends' },
                  { option: { text: 'B', value: 'B', selected: false } }
                )
              ),
              resolveInitLock(toVariablePayload({ type: 'query', id: 'queryNoDepends' }))
            );
          });
        });
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
          const { list, custom, queryDependsOnCustom } = getAndSetupProcessVariableContext();
          queryDependsOnCustom.refresh = refresh;
          const customProcessed = await reduxTester<{ templating: TemplatingState }>()
            .givenRootReducer(getTemplatingRootReducer())
            .whenActionIsDispatched(initDashboardTemplating(list))
            .whenAsyncActionIsDispatched(processVariable(toVariableIdentifier(custom), queryParams)); // Need to process this dependency otherwise we never complete the promise chain

          const tester = await customProcessed.whenAsyncActionIsDispatched(
            processVariable(toVariableIdentifier(queryDependsOnCustom), queryParams),
            true
          );

          await tester.thenDispatchedActionsShouldEqual(
            resolveInitLock(toVariablePayload({ type: 'query', id: 'queryDependsOnCustom' }))
          );
        });
      });

      [VariableRefresh.onDashboardLoad, VariableRefresh.onTimeRangeChanged].forEach(refresh => {
        describe(`and refresh is ${refresh}`, () => {
          it('then correct actions are dispatched', async () => {
            const { list, custom, queryDependsOnCustom } = getAndSetupProcessVariableContext();
            queryDependsOnCustom.refresh = refresh;
            const customProcessed = await reduxTester<{ templating: TemplatingState }>()
              .givenRootReducer(getTemplatingRootReducer())
              .whenActionIsDispatched(initDashboardTemplating(list))
              .whenAsyncActionIsDispatched(processVariable(toVariableIdentifier(custom), queryParams)); // Need to process this dependency otherwise we never complete the promise chain

            const tester = await customProcessed.whenAsyncActionIsDispatched(
              processVariable(toVariableIdentifier(queryDependsOnCustom), queryParams),
              true
            );

            await tester.thenDispatchedActionsShouldEqual(
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
              ),
              setCurrentVariableValue(
                toVariablePayload(
                  { type: 'query', id: 'queryDependsOnCustom' },
                  { option: { text: 'AA', value: 'AA', selected: false } }
                )
              ),
              resolveInitLock(toVariablePayload({ type: 'query', id: 'queryDependsOnCustom' }))
            );
          });
        });
      });
    });

    describe('and queryParams does match variable', () => {
      const queryParams: UrlQueryMap = { 'var-queryDependsOnCustom': 'AB' };

      describe('and refresh is VariableRefresh.never', () => {
        const refresh = VariableRefresh.never;
        it('then correct actions are dispatched', async () => {
          const { list, custom, queryDependsOnCustom } = getAndSetupProcessVariableContext();
          queryDependsOnCustom.refresh = refresh;
          const customProcessed = await reduxTester<{ templating: TemplatingState }>()
            .givenRootReducer(getTemplatingRootReducer())
            .whenActionIsDispatched(initDashboardTemplating(list))
            .whenAsyncActionIsDispatched(processVariable(toVariableIdentifier(custom), queryParams)); // Need to process this dependency otherwise we never complete the promise chain

          const tester = await customProcessed.whenAsyncActionIsDispatched(
            processVariable(toVariableIdentifier(queryDependsOnCustom), queryParams),
            true
          );

          await tester.thenDispatchedActionsShouldEqual(
            setCurrentVariableValue(
              toVariablePayload(
                { type: 'query', id: 'queryDependsOnCustom' },
                { option: { text: 'AB', value: 'AB', selected: false } }
              )
            ),
            resolveInitLock(toVariablePayload({ type: 'query', id: 'queryDependsOnCustom' }))
          );
        });
      });

      [VariableRefresh.onDashboardLoad, VariableRefresh.onTimeRangeChanged].forEach(refresh => {
        describe(`and refresh is ${
          refresh === VariableRefresh.onDashboardLoad
            ? 'VariableRefresh.onDashboardLoad'
            : 'VariableRefresh.onTimeRangeChanged'
        }`, () => {
          it('then correct actions are dispatched', async () => {
            const { list, custom, queryDependsOnCustom } = getAndSetupProcessVariableContext();
            queryDependsOnCustom.refresh = refresh;
            const customProcessed = await reduxTester<{ templating: TemplatingState }>()
              .givenRootReducer(getTemplatingRootReducer())
              .whenActionIsDispatched(initDashboardTemplating(list))
              .whenAsyncActionIsDispatched(processVariable(toVariableIdentifier(custom), queryParams)); // Need to process this dependency otherwise we never complete the promise chain

            const tester = await customProcessed.whenAsyncActionIsDispatched(
              processVariable(toVariableIdentifier(queryDependsOnCustom), queryParams),
              true
            );

            await tester.thenDispatchedActionsShouldEqual(
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
              ),
              setCurrentVariableValue(
                toVariablePayload(
                  { type: 'query', id: 'queryDependsOnCustom' },
                  { option: { text: 'AA', value: 'AA', selected: false } }
                )
              ),
              setCurrentVariableValue(
                toVariablePayload(
                  { type: 'query', id: 'queryDependsOnCustom' },
                  { option: { text: 'AB', value: 'AB', selected: false } }
                )
              ),
              resolveInitLock(toVariablePayload({ type: 'query', id: 'queryDependsOnCustom' }))
            );
          });
        });
      });
    });
  });
});
