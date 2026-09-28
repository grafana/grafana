import { type TemplateSrv } from '@grafana/runtime';

import { type GraphiteDatasource } from '../datasource';

import { actions } from './actions';
import { createStore, type GraphiteQueryEditorState } from './store';

jest.mock('./helpers', () => ({
  ...jest.requireActual('./helpers'),
  buildSegments: jest.fn(() => Promise.resolve()),
  parseTarget: jest.fn(() => Promise.resolve()),
  handleTargetChanged: jest.fn(),
}));

function createDatasource(waitForFuncDefsLoaded: () => Promise<void>) {
  return {
    waitForFuncDefsLoaded,
    supportsTags: false,
    funcDefs: {},
  } as unknown as GraphiteDatasource;
}

function initAction(datasource: GraphiteDatasource, target = 'initial.target') {
  return actions.init({
    target: { refId: 'A', target, targetFull: '', textEditor: false, paused: false },
    datasource,
    range: undefined,
    templateSrv: { replace: (value: string) => value } as unknown as TemplateSrv,
    queries: [],
    refresh: jest.fn(),
  });
}

describe('createStore', () => {
  it('applies queryChanged dispatched while init is still waiting for function definitions', async () => {
    let resolveFuncDefs: () => void = () => {};
    const funcDefsLoaded = new Promise<void>((resolve) => (resolveFuncDefs = resolve));
    const datasource = createDatasource(() => funcDefsLoaded);
    const onChange = jest.fn();
    const dispatch = createStore(onChange);

    const init = dispatch(initAction(datasource));
    const queryChanged = dispatch(actions.queryChanged({ refId: 'A', target: 'updated.target' }));

    resolveFuncDefs();
    await expect(init).resolves.toBeUndefined();
    await expect(queryChanged).resolves.toBeUndefined();

    const finalState: GraphiteQueryEditorState = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(finalState.target.target).toBe('updated.target');
  });

  it('keeps processing actions after a failed dispatch', async () => {
    const onChange = jest.fn();
    const dispatch = createStore(onChange);

    const failedInit = dispatch(initAction(createDatasource(() => Promise.reject(new Error('failed')))));
    await expect(failedInit).rejects.toThrow('failed');

    await dispatch(initAction(createDatasource(() => Promise.resolve()), 'second.target'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].target.target).toBe('second.target');
  });

  it('returns the state unchanged for target-dependent actions before init', async () => {
    const onChange = jest.fn();
    const dispatch = createStore(onChange);

    await expect(dispatch(actions.queryChanged({ refId: 'A', target: 'a.b' }))).resolves.toBeUndefined();
    await expect(dispatch(actions.updateQuery({ query: 'a.b' }))).resolves.toBeUndefined();

    expect(onChange).toHaveBeenLastCalledWith({});
  });
});
