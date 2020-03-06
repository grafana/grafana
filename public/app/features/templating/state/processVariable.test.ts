import { UrlQueryMap } from '@grafana/runtime';

import { getTemplatingRootReducer, variableMockBuilder } from './helpers';
import { variableAdapters } from '../adapters';
import { createQueryVariableAdapter } from '../query/adapter';
import { createCustomVariableAdapter } from '../custom/adapter';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { TemplatingState } from 'app/features/templating/state/reducers';
import { initDashboardTemplating, processVariable } from './actions';
import { resolveInitLock, setCurrentVariableValue } from './sharedReducer';
import { toVariableIdentifier, toVariablePayload } from './types';
import { VariableRefresh } from '../variable';
import { updateVariableOptions } from '../query/reducer';

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

describe('processVariable', () => {
  // these following processVariable tests will test the following base setup
  // custom doesn't depend on any other variable
  // queryDependsOnCustom depends on custom
  // queryNoDepends doesn't depend on any other variable
  const getAndSetupProcessVariableContext = () => {
    variableAdapters.set('custom', createCustomVariableAdapter());
    variableAdapters.set('query', createQueryVariableAdapter());
    const custom = variableMockBuilder('custom')
      .withUuid('0')
      .withQuery('A,B,C')
      .withOptions('A', 'B', 'C')
      .withCurrent('A')
      .create();

    const queryDependsOnCustom = variableMockBuilder('query')
      .withUuid('1')
      .withName('queryDependsOnCustom')
      .withQuery('$custom.*')
      .withOptions('AA', 'AB', 'AC')
      .withCurrent('AA')
      .create();

    const queryNoDepends = variableMockBuilder('query')
      .withUuid('2')
      .withName('queryNoDepends')
      .withQuery('*')
      .withOptions('A', 'B', 'C')
      .withCurrent('A')
      .create();

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

        await tester.thenDispatchedActionShouldEqual(resolveInitLock(toVariablePayload({ type: 'custom', uuid: '0' })));
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

        await tester.thenDispatchedActionShouldEqual(
          setCurrentVariableValue(
            toVariablePayload({ type: 'custom', uuid: '0' }, { option: { text: ['B'], value: ['B'], selected: false } })
          ),
          resolveInitLock(toVariablePayload({ type: 'custom', uuid: '0' }))
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

          await tester.thenDispatchedActionShouldEqual(
            resolveInitLock(toVariablePayload({ type: 'query', uuid: '2' }))
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

            await tester.thenDispatchedActionShouldEqual(
              updateVariableOptions(
                toVariablePayload({ type: 'query', uuid: '2' }, [
                  { value: 'A', text: 'A' },
                  { value: 'B', text: 'B' },
                  { value: 'C', text: 'C' },
                ])
              ),
              setCurrentVariableValue(
                toVariablePayload({ type: 'query', uuid: '2' }, { option: { text: 'A', value: 'A', selected: false } })
              ),
              resolveInitLock(toVariablePayload({ type: 'query', uuid: '2' }))
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

          await tester.thenDispatchedActionShouldEqual(
            setCurrentVariableValue(
              toVariablePayload(
                { type: 'query', uuid: '2' },
                { option: { text: ['B'], value: ['B'], selected: false } }
              )
            ),
            resolveInitLock(toVariablePayload({ type: 'query', uuid: '2' }))
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

            await tester.thenDispatchedActionShouldEqual(
              updateVariableOptions(
                toVariablePayload({ type: 'query', uuid: '2' }, [
                  { value: 'A', text: 'A' },
                  { value: 'B', text: 'B' },
                  { value: 'C', text: 'C' },
                ])
              ),
              setCurrentVariableValue(
                toVariablePayload({ type: 'query', uuid: '2' }, { option: { text: 'A', value: 'A', selected: false } })
              ),
              setCurrentVariableValue(
                toVariablePayload(
                  { type: 'query', uuid: '2' },
                  { option: { text: ['B'], value: ['B'], selected: false } }
                )
              ),
              resolveInitLock(toVariablePayload({ type: 'query', uuid: '2' }))
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

          await tester.thenDispatchedActionShouldEqual(
            resolveInitLock(toVariablePayload({ type: 'query', uuid: '1' }))
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

            await tester.thenDispatchedActionShouldEqual(
              updateVariableOptions(
                toVariablePayload({ type: 'query', uuid: '1' }, [
                  { value: 'AA', text: 'AA' },
                  { value: 'AB', text: 'AB' },
                  { value: 'AC', text: 'AC' },
                ])
              ),
              setCurrentVariableValue(
                toVariablePayload(
                  { type: 'query', uuid: '1' },
                  { option: { text: 'AA', value: 'AA', selected: false } }
                )
              ),
              resolveInitLock(toVariablePayload({ type: 'query', uuid: '1' }))
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

          await tester.thenDispatchedActionShouldEqual(
            setCurrentVariableValue(
              toVariablePayload(
                { type: 'query', uuid: '1' },
                { option: { text: ['AB'], value: ['AB'], selected: false } }
              )
            ),
            resolveInitLock(toVariablePayload({ type: 'query', uuid: '1' }))
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

            await tester.thenDispatchedActionShouldEqual(
              updateVariableOptions(
                toVariablePayload({ type: 'query', uuid: '1' }, [
                  { value: 'AA', text: 'AA' },
                  { value: 'AB', text: 'AB' },
                  { value: 'AC', text: 'AC' },
                ])
              ),
              setCurrentVariableValue(
                toVariablePayload(
                  { type: 'query', uuid: '1' },
                  { option: { text: 'AA', value: 'AA', selected: false } }
                )
              ),
              setCurrentVariableValue(
                toVariablePayload(
                  { type: 'query', uuid: '1' },
                  { option: { text: ['AB'], value: ['AB'], selected: false } }
                )
              ),
              resolveInitLock(toVariablePayload({ type: 'query', uuid: '1' }))
            );
          });
        });
      });
    });
  });
});
