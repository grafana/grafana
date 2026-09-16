import { type AnyAction } from '@reduxjs/toolkit';

import { type TemplateSrv } from '@grafana/runtime';

import { GraphiteDatasource } from '../datasource';
import gfunc, { type FuncDefs, type FuncInstance } from '../gfunc';

import { actions } from './actions';
import { createStore, type GraphiteQueryEditorState } from './store';

jest.mock('@grafana/runtime', () => ({
  ...(jest.requireActual('@grafana/runtime') as unknown as object),
  getAppEvents: () => ({
    publish: jest.fn(),
  }),
}));

// dispatch resolves when the action has been reduced
type TestDispatch = (action: AnyAction) => Promise<void>;

const templateSrv = { replace: jest.fn((value: string) => value), getVariables: jest.fn(() => []) };

function createTestStore(onChange: (state: GraphiteQueryEditorState) => void = () => {}): TestDispatch {
  return createStore(onChange) as unknown as TestDispatch;
}

function createDatasource(): GraphiteDatasource {
  const datasource = new GraphiteDatasource({
    url: '/api/datasources/proxy/1',
    name: 'graphiteProd',
    jsonData: {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  datasource.metricFindQuery = jest.fn(() => Promise.resolve([]));
  datasource.getFuncDefs = jest.fn(() => Promise.resolve(gfunc.getFuncDefs('1.0')));
  datasource.getFuncDef = gfunc.getFuncDef;
  datasource.createFuncInstance = gfunc.createFuncInstance;
  datasource.waitForFuncDefsLoaded = jest.fn(() => Promise.resolve(gfunc.getFuncDefs('1.0')));

  return datasource;
}

function initAction(datasource: GraphiteDatasource, target: string) {
  return actions.init({
    datasource,
    target: { refId: 'A', target },
    refresh: jest.fn(),
    queries: [],
    templateSrv: templateSrv as unknown as TemplateSrv,
  });
}

describe('createStore', () => {
  it('queues actions dispatched while init is still awaiting the datasource', async () => {
    const datasource = createDatasource();
    let resolveFuncDefs: (funcDefs: FuncDefs) => void = () => {};
    const funcDefsLoaded = new Promise<FuncDefs>((resolve) => {
      resolveFuncDefs = resolve;
    });
    datasource.waitForFuncDefsLoaded = jest.fn(() => funcDefsLoaded);

    let state: GraphiteQueryEditorState | undefined;
    const dispatch = createTestStore((newState) => {
      state = newState;
    });

    const init = dispatch(initAction(datasource, 'test.prod.*'));
    // dispatched before init finished reducing - it must not run on an uninitialized state
    const queryChanged = dispatch(actions.queryChanged({ refId: 'A', target: 'test.staging.*' }));

    expect(state).toBeUndefined();

    // let pending microtasks run: init is still waiting for the datasource, so nothing is reduced yet
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(state).toBeUndefined();
    expect(datasource.metricFindQuery).not.toHaveBeenCalled();

    resolveFuncDefs(gfunc.getFuncDefs('1.0'));

    await expect(Promise.all([init, queryChanged])).resolves.toBeDefined();

    expect(state?.target.target).toBe('test.staging.*');
  });

  it('ignores actions dispatched before init', async () => {
    const onChange = jest.fn();
    const dispatch = createTestStore(onChange);

    await expect(dispatch(actions.queryChanged({ refId: 'A', target: 'test.prod.*' }))).resolves.toBeUndefined();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps reducing actions after one of them fails', async () => {
    let state: GraphiteQueryEditorState | undefined;
    const dispatch = createTestStore((newState) => {
      state = newState;
    });

    await dispatch(initAction(createDatasource(), 'test.prod.*'));

    const brokenFunc = {
      updateParam: () => {
        throw new Error('failed to update param');
      },
    } as unknown as FuncInstance;

    await expect(dispatch(actions.updateFunctionParam({ func: brokenFunc, index: 0, value: 'a' }))).rejects.toThrow(
      'failed to update param'
    );

    await dispatch(actions.queryChanged({ refId: 'A', target: 'test.staging.*' }));

    expect(state?.target.target).toBe('test.staging.*');
  });
});
