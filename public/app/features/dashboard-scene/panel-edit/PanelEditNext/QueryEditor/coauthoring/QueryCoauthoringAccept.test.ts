import { waitFor } from '@testing-library/react';

import { type DataQuery, LoadingState } from '@grafana/data';
import { ConstantVariable, SceneQueryRunner, SceneTimeRange, SceneVariableSet, VizPanel } from '@grafana/scenes';

import { CoauthoringQueriesAcceptedEvent } from '../../../../sidebar/events';

import { QueryCoauthoringRuns } from './QueryCoauthoringRuns';
import { QueryCoauthoringSessionEngine } from './QueryCoauthoringSessionEngine';
import {
  type CoauthoringResolverIdentity,
  type ResolvedCoauthoringQuery,
  resolveCoauthoringQuery,
} from './queryCoauthoringContext';
import { type QueryCoauthoringLanguage } from './queryCoauthoringContracts';

jest.mock('./queryCoauthoringContext', () => ({
  ...jest.requireActual('./queryCoauthoringContext'),
  resolveCoauthoringQuery: jest.fn(),
}));
const mockDisposeRuns = jest.fn();
jest.mock('./QueryCoauthoringRuns', () => ({
  QueryCoauthoringRuns: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    select: jest.fn(),
    dispose: mockDisposeRuns,
    canonicalData: jest.fn(),
    ownsData: () => false,
  })),
}));

const resolve = jest.mocked(resolveCoauthoringQuery);
const text = (query: DataQuery) => ('expr' in query && typeof query.expr === 'string' ? query.expr : '');
const language: QueryCoauthoringLanguage = {
  version: 1,
  getQuerySupport: () => ({ editable: true }),
  describe: jest.fn(async (query) => ({ text: text(query), language: { id: 'mock', displayName: 'Mock' } })),
  prepare: jest.fn((query, proposed) => {
    const prepared = { ...query, expr: proposed };
    return {
      status: 'ready',
      query: prepared,
      changes: [
        {
          original: text(query),
          proposed,
          originalRanges: [{ from: 0, to: text(query).length }],
          proposedRanges: [{ from: 0, to: proposed.length }],
        },
      ],
    };
  }),
};
const cleanups: Array<() => void> = [];
let activation = { isActive: true };
let previousActivation: PropertyDescriptor | undefined;

beforeEach(() => {
  jest.clearAllMocks();
  resolve.mockReset();
  mockDisposeRuns.mockReset();
  previousActivation = Object.getOwnPropertyDescriptor(navigator, 'userActivation');
  activation = { isActive: true };
  Object.defineProperty(navigator, 'userActivation', { configurable: true, value: activation });
});
afterEach(() => {
  cleanups.splice(0).forEach((stop) => stop());
  if (previousActivation) {
    Object.defineProperty(navigator, 'userActivation', previousActivation);
  } else {
    Reflect.deleteProperty(navigator, 'userActivation');
  }
  jest.restoreAllMocks();
});

async function setup(twoQueries = false) {
  const variable = new ConstantVariable({ name: 'source', value: 'mock-one' });
  const timeRange = new SceneTimeRange({ from: '2026-11-01T00:00:00Z', to: '2026-11-01T01:00:00Z' });
  const queries = [{ refId: 'A', expr: 'baseline' }, ...(twoQueries ? [{ refId: 'B', expr: 'sibling' }] : [])];
  const runner = new SceneQueryRunner({ queries, datasource: { uid: '${source}' }, runQueriesMode: 'manual' });
  const run = jest.spyOn(runner, 'runQueries').mockImplementation(() => {});
  const panel = new VizPanel({
    key: 'panel-1',
    $data: runner,
    $timeRange: timeRange,
    $variables: new SceneVariableSet({ variables: [variable] }),
  });
  const identity: CoauthoringResolverIdentity = {
    datasource: {},
    factory: () => language,
    configuration: { uid: 'mock-one' },
    support: { kind: 'editable' },
  };
  const resolved = (current = identity): ResolvedCoauthoringQuery => ({
    identity: current,
    editability: current.support,
    language,
    description: { status: 'ready', value: { text: 'baseline', language: { id: 'mock', displayName: 'Mock' } } },
    current: jest.fn(async () => true),
  });
  resolve.mockImplementation(async (_panel, query) =>
    resolved(query.refId === 'B' ? { ...identity, support: { kind: 'read_only' } } : identity)
  );
  const engine = new QueryCoauthoringSessionEngine(panel);
  const session = engine.enter('A');
  const accepted = jest.fn();
  const events = panel.subscribeToEvent(CoauthoringQueriesAcceptedEvent, accepted);
  cleanups.push(() => {
    engine.dispose();
    events.unsubscribe();
  });
  const stage = () =>
    session.stageProposal(
      [{ changes: [{ refId: 'A', text: 'proposed' }] }, { changes: [{ refId: 'A', text: 'alternative' }] }],
      { baseRevision: engine.getRevision(), baseContextGeneration: engine.getContextGeneration() }
    );
  const results = await stage();
  const first = results[0];
  const second = results[1];
  if (first.status !== 'staged' || second.status !== 'staged') {
    throw new Error('Expected staged mock options');
  }
  resolve.mockClear();
  return {
    variable,
    timeRange,
    runner,
    run,
    identity,
    resolved,
    engine,
    session,
    accepted,
    stage,
    firstId: first.id,
    secondId: second.id,
    queries,
  };
}

describe('Accept effective datasource policy (isolated mocks)', () => {
  it.each(['instance', 'factory', 'configuration', 'read_only', 'unknown'] as const)(
    'refuses changed %s without a canonical write or history event',
    async (change) => {
      const f = await setup();
      const identity = { ...f.identity };
      if (change === 'instance') {
        identity.datasource = {};
      }
      if (change === 'factory') {
        identity.factory = () => language;
      }
      if (change === 'configuration') {
        identity.configuration = { uid: 'mock-two' };
      }
      if (change === 'read_only') {
        identity.support = { kind: 'read_only' };
      }
      if (change === 'unknown') {
        identity.support = { kind: 'unknown', reason: 'missing_query_support' };
      }
      resolve.mockResolvedValue(f.resolved(identity));

      expect(await f.session.accept(f.firstId, { baseRevision: 0 })).toEqual({ status: 'stale' });
      expect(f.runner.state.queries).toEqual(f.queries);
      expect(f.session.getState()).toMatchObject({ stale: true, previewedOption: 'original' });
      expect(f.run).not.toHaveBeenCalled();
      expect(f.accepted).not.toHaveBeenCalled();
    }
  );

  it('allows unchanged editable support with a read-only unchanged sibling and keeps session Undo', async () => {
    const f = await setup(true);
    expect(await f.session.accept(f.firstId, { baseRevision: 0 })).toEqual({ status: 'applied', revision: 1 });
    expect(f.runner.state.queries).toEqual([
      { refId: 'A', expr: 'proposed' },
      { refId: 'B', expr: 'sibling' },
    ]);
    expect(resolve).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { uid: '${source}' },
      expect.anything(),
      false
    );
    expect(f.run).toHaveBeenCalledTimes(1);
    expect(f.accepted).toHaveBeenCalledTimes(1);
    expect(f.accepted).toHaveBeenCalledWith(expect.objectContaining({ payload: { panelId: 1 } }));
    expect(await f.session.undo({})).toEqual({ status: 'applied', revision: 2 });
    expect(f.runner.state.queries).toEqual(f.queries);
  });

  it('allows a time-range-only change between staging and Accept', async () => {
    const f = await setup();
    f.timeRange.onTimeRangeChange(
      new SceneTimeRange({ from: '2026-11-02T00:00:00Z', to: '2026-11-02T01:00:00Z' }).state.value
    );
    expect(f.engine.getContextGeneration()).toBeGreaterThan(0);
    expect(await f.session.accept(f.firstId, { baseRevision: 0 })).toEqual({ status: 'applied', revision: 1 });
    expect(f.runner.state.queries).toEqual([{ refId: 'A', expr: 'proposed' }]);
  });

  it.each(['selection', 'revision', 'stage', 'caller', 'closed', 'preview_error'] as const)(
    'fences a deferred completion after %s changes without history mutation',
    async (change) => {
      const f = await setup();
      let finish: ((value: ResolvedCoauthoringQuery) => void) | undefined;
      resolve.mockImplementationOnce(
        () =>
          new Promise((done) => {
            finish = done;
          })
      );
      const controller = new AbortController();
      const result = f.session.accept(f.firstId, { baseRevision: 0, signal: controller.signal });
      expect(resolve).toHaveBeenCalledTimes(1);
      if (change === 'selection') {
        f.session.preview(f.secondId);
      }
      if (change === 'revision') {
        f.runner.setState({ queries: [{ refId: 'A', expr: 'manual' }] });
      }
      if (change === 'stage') {
        await f.stage();
      }
      if (change === 'caller') {
        controller.abort();
      }
      if (change === 'closed') {
        f.session.exit();
      }
      if (change === 'preview_error') {
        const onData = jest.mocked(QueryCoauthoringRuns).mock.calls.at(-1)?.[3];
        if (!onData) {
          throw new Error('Missing mocked preview result callback');
        }
        onData(f.firstId, {
          state: LoadingState.Error,
          series: [],
          timeRange: f.timeRange.state.value,
          error: { refId: 'A', message: 'Mock preview unavailable' },
        });
      }
      const current = f.runner.state.queries;
      if (!finish) {
        throw new Error('Expected deferred mock resolver');
      }
      finish(f.resolved());
      expect(await result).toEqual({
        status:
          change === 'caller'
            ? 'aborted'
            : change === 'closed'
              ? 'closed'
              : change === 'preview_error'
                ? 'blocked'
                : 'stale',
      });
      expect(f.runner.state.queries).toEqual(current);
      expect(f.run).not.toHaveBeenCalled();
      expect(f.accepted).not.toHaveBeenCalled();
    }
  );

  it('honors the entry gesture when transient activation expires during mocked validation', async () => {
    const f = await setup();
    let finish: ((value: ResolvedCoauthoringQuery) => void) | undefined;
    resolve.mockImplementationOnce(() => new Promise((done) => (finish = done)));
    const result = f.session.accept(f.firstId, { baseRevision: 0 });
    expect(resolve).toHaveBeenCalledTimes(1);
    activation.isActive = false;
    if (!finish) {
      throw new Error('Expected deferred mock resolver');
    }
    finish(f.resolved());
    expect(await result).toEqual({ status: 'applied', revision: 1 });
    expect(f.runner.state.queries).toEqual([{ refId: 'A', expr: 'proposed' }]);
    expect(f.accepted).toHaveBeenCalledTimes(1);
  });

  it.each(['caller', 'selection', 'revision'] as const)(
    'keeps review projection truthful after cleanup changes %s',
    async (change) => {
      const f = await setup();
      f.session.preview(f.firstId);
      const runsBefore = jest.mocked(QueryCoauthoringRuns).mock.calls.length;
      const controller = new AbortController();
      mockDisposeRuns.mockImplementationOnce(() => {
        if (change === 'caller') {
          controller.abort();
        } else if (change === 'selection') {
          f.session.preview(f.secondId);
        } else {
          f.runner.setState({ queries: [{ refId: 'A', expr: 'manual' }] });
        }
      });
      expect(await f.session.accept(f.firstId, { baseRevision: 0, signal: controller.signal })).toEqual({
        status: change === 'caller' ? 'aborted' : 'stale',
      });
      expect(f.session.getState().previewedOption).toBe(change === 'selection' ? f.secondId : 'original');
      expect(f.runner.state.queries).toEqual(change === 'revision' ? [{ refId: 'A', expr: 'manual' }] : f.queries);
      expect(f.accepted).not.toHaveBeenCalled();
      expect(f.run).not.toHaveBeenCalled();
      if (change === 'caller') {
        const latest = jest.mocked(QueryCoauthoringRuns).mock.results.at(-1)?.value;
        expect(jest.mocked(QueryCoauthoringRuns)).toHaveBeenCalledTimes(runsBefore + 1);
        expect(latest.start).toHaveBeenCalledTimes(1);
      }
    }
  );

  it('keeps Apply/Original idle through listener reactivation while explicit preview and Undo still run', async () => {
    const f = await setup();
    expect(await f.session.accept(f.firstId, { baseRevision: 0 })).toEqual({ status: 'applied', revision: 1 });
    const calls = jest.mocked(QueryCoauthoringRuns).mock.calls.length;
    const applied = f.session.getState();
    f.engine.setSurfaceActive(false);
    f.engine.setSurfaceActive(true);
    expect(jest.mocked(QueryCoauthoringRuns)).toHaveBeenCalledTimes(calls);
    expect(f.session.getState()).toEqual(applied);
    f.session.preview(f.firstId);
    expect(jest.mocked(QueryCoauthoringRuns)).toHaveBeenCalledTimes(calls + 1);
    f.session.preview('original');
    expect(await f.session.undo({})).toEqual({ status: 'applied', revision: 2 });
    expect(jest.mocked(QueryCoauthoringRuns)).toHaveBeenCalledTimes(calls + 2);
  });

  it('anchors current resolver inputs across multiple mocked awaits', async () => {
    const f = await setup(true);
    let finish: ((value: ResolvedCoauthoringQuery) => void) | undefined;
    resolve.mockImplementation(async (_panel, query) =>
      query.refId === 'B'
        ? new Promise((done) => {
            finish = done;
          })
        : f.resolved()
    );
    const result = f.session.accept(f.firstId, { baseRevision: 0 });
    expect(resolve).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(finish).toBeDefined());
    f.variable.setState({ value: 'mock-two' });
    if (!finish) {
      throw new Error('Expected second deferred mock resolver');
    }
    finish(f.resolved({ ...f.identity, support: { kind: 'read_only' } }));
    expect(await result).toEqual({ status: 'stale' });
    expect(f.runner.state.queries).toEqual(f.queries);
    expect(f.accepted).not.toHaveBeenCalled();
    expect(f.run).not.toHaveBeenCalled();
  });
});

describe('obsolete resolver completions (isolated mocks)', () => {
  it.each(['context', 'stage'] as const)(
    '%s cannot mutate context after a newer resolver snapshot',
    async (operation) => {
      const f = await setup();
      let finish: ((value: ResolvedCoauthoringQuery) => void) | undefined;
      resolve.mockImplementationOnce(() => new Promise((done) => (finish = done)));
      const old = operation === 'context' ? f.session.getContext({ baseRevision: 0 }) : f.stage();
      f.variable.setState({ value: 'mock-two' });
      const fresh = await f.session.getContext({ baseRevision: 0 });
      expect(fresh.status).toBe('ready');
      const generation = f.engine.getContextGeneration();
      if (!finish) {
        throw new Error('Expected old resolver');
      }
      finish(f.resolved({ ...f.identity, datasource: {} }));
      expect(await old).toMatchObject(
        operation === 'context' ? { status: 'stale' } : [{ status: 'stale' }, { status: 'stale' }]
      );
      expect(f.engine.getContextGeneration()).toBe(generation);
      expect((await f.session.getContext({ baseRevision: 0 })).status).toBe('ready');
      expect(f.engine.getContextGeneration()).toBe(generation);
    }
  );

  it('an obsolete context validator cannot invalidate a newer read', async () => {
    const f = await setup();
    let finish: ((value: boolean) => void) | undefined;
    resolve.mockResolvedValueOnce({ ...f.resolved(), current: () => new Promise((done) => (finish = done)) });
    const old = f.session.getContext({ baseRevision: 0 });
    await waitFor(() => expect(finish).toBeDefined());
    f.variable.setState({ value: 'mock-two' });
    expect((await f.session.getContext({ baseRevision: 0 })).status).toBe('ready');
    const generation = f.engine.getContextGeneration();
    if (!finish) {
      throw new Error('Expected old validation');
    }
    finish(false);
    expect(await old).toMatchObject({ status: 'stale' });
    expect(f.engine.getContextGeneration()).toBe(generation);
  });
});
