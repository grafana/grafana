import * as runtime from '@grafana/runtime';
import { DashboardModel } from 'app/features/dashboard/state';

import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { variableAdapters } from '../adapters';
import { setVariableQueryRunner, VariableQueryRunner } from '../query/VariableQueryRunner';
import { createQueryVariableAdapter } from '../query/adapter';
import { queryBuilder } from '../shared/testing/builders';
import { VariableModel } from '../types';

import { initDashboardTemplating, processVariables, setOptionAsCurrent } from './actions';
import { getPreloadedState, getTemplatingRootReducer, TemplatingReducerType } from './helpers';
import { toKeyedAction } from './keyedVariablesReducer';
import { variablesCompleteTransaction, variablesInitTransaction } from './transactionReducer';
import { KeyedVariableIdentifier } from './types';

variableAdapters.setInit(() => [createQueryVariableAdapter()]);

setVariableQueryRunner(new VariableQueryRunner());

let variableEvaluationOrder: string[] = [];
runtime.setDataSourceSrv({
  get: () => {
    return {
      metricFindQuery: (_: string, { variable }: { variable: VariableModel }) => {
        variableEvaluationOrder.push(variable.name);
        return Promise.resolve([{ text: 'foo' }]);
      },
    };
  },
  getList: () => Promise.resolve([]),
} as any);

describe('circularVariables', () => {
  it('should work for bi-directional dependency', async () => {
    const actual = await getVariableEvaluationOrder('A', {
      A: ['B'],
      B: ['A'],
    });
    const expected = ['B'];

    expect(actual).toEqual(expected);
  });

  it('should cycle through 3 variable loop', async () => {
    const actual = await getVariableEvaluationOrder('A', {
      A: ['B'],
      B: ['C'],
      C: ['A'],
    });
    const expected = ['C', 'B'];

    expect(actual).toEqual(expected);
  });

  it('should work with two connected loops', async () => {
    const actual = await getVariableEvaluationOrder('C2', {
      A: ['C1', 'C2'],
      B1: ['A'],
      B2: ['A'],
      C1: ['B1'],
      C2: ['B2'],
    });
    const expected = ['A', 'B1', 'B2', 'C1'];

    expect(actual).toEqual(expected);
  });

  it('should work when everything depends on everything else', async () => {
    const actual = await getVariableEvaluationOrder('A', {
      A: ['B', 'C', 'D', 'E'],
      B: ['A', 'C', 'D', 'E'],
      C: ['A', 'B', 'D', 'E'],
      D: ['A', 'B', 'C', 'E'],
      E: ['A', 'B', 'C', 'D'],
    });
    const expected = ['E', 'D', 'C', 'B'];

    expect(actual).toEqual(expected);
  });

  it('evaluation order should differ depending on which node was triggered', async () => {
    const actual = await getVariableEvaluationOrder('B', {
      A: ['B', 'C', 'D', 'E'],
      B: ['A', 'C', 'D', 'E'],
      C: ['A', 'B', 'D', 'E'],
      D: ['A', 'B', 'C', 'E'],
      E: ['A', 'B', 'C', 'D'],
    });
    const expected = ['E', 'D', 'C', 'A'];

    expect(actual).toEqual(expected);
  });
});

async function getVariableEvaluationOrder(triggerVariable: string, variables: Record<string, string[]>) {
  // Setup dashboard with given variable configuration
  const key = 'key';
  const list = Object.entries(variables).map(([varName, deps]) => {
    return queryBuilder()
      .withName(varName)
      .withQuery(deps.map((dep) => '$' + dep).join(' '))
      .build();
  });
  const dashboardTester = (
    await reduxTester<TemplatingReducerType>({ preloadedState: getPreloadedState(key, {}) })
      .givenRootReducer(getTemplatingRootReducer())
      .whenActionIsDispatched(toKeyedAction(key, variablesInitTransaction({ uid: key })))
      .whenActionIsDispatched(initDashboardTemplating(key, { templating: { list } } as DashboardModel))
      .whenAsyncActionIsDispatched(processVariables(key), true)
  ).whenActionIsDispatched(toKeyedAction(key, variablesCompleteTransaction({ uid: key })));

  // Reset evaluation order
  variableEvaluationOrder = [];

  // Trigger an update starting at `triggerVariable`
  const triggerVariableIdentifier: KeyedVariableIdentifier = {
    id: triggerVariable,
    rootStateKey: key,
    type: 'query',
  };
  await dashboardTester.whenAsyncActionIsDispatched(
    setOptionAsCurrent(triggerVariableIdentifier, [], { text: 'bar', value: 'bar', selected: false }, true)
  );

  return [...variableEvaluationOrder];
}
