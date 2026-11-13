import { waitFor } from '@testing-library/react';
import { Observable, of, type Subscriber } from 'rxjs';

import {
  type DataQuery,
  type DataQueryRequest,
  FieldType,
  LoadingState,
  type PanelData,
  toDataFrame,
} from '@grafana/data';
import { setRunRequest } from '@grafana/runtime';
import { SceneQueryRunner, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { getMockDataSource } from 'app/features/query/state/mocks/mockDataSource';

import { PanelDataPaneNext } from '../../PanelDataPaneNext';

import {
  type QueryCoauthoringLanguage,
  type QueryCoauthoringSession,
  type QueryCoauthoringStageResult,
} from './queryCoauthoringContracts';

const mockGetDataSource = jest.fn();
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({ get: mockGetDataSource }),
  getDataSourceInstance: (...args: unknown[]) => mockGetDataSource(...args),
}));

interface TextQuery extends DataQuery {
  expr: string;
  legendFormat?: string;
}
const original: TextQuery[] = [
  { refId: 'A', expr: 'up', legendFormat: 'requests' },
  { refId: 'B', expr: 'rate(requests[5m])' },
];
const language: QueryCoauthoringLanguage<TextQuery> = {
  version: 1,
  describe: async (query) => ({ text: query.expr, language: { id: 'promql', displayName: 'PromQL' } }),
  prepare: (query, text) =>
    text === 'invalid'
      ? { status: 'rejected', reason: 'invalid' }
      : text === query.expr
        ? { status: 'rejected', reason: 'unchanged' }
        : {
            status: 'ready',
            query: { ...query, expr: text },
            changes: [
              {
                original: query.expr,
                proposed: text,
                originalRanges: [{ from: 0, to: query.expr.length }],
                proposedRanges: [{ from: 0, to: text.length }],
              },
            ],
          },
};

function stagedId(result: QueryCoauthoringStageResult): string {
  if (result.status !== 'staged') {
    throw new Error(`Expected staged option, got ${result.status}`);
  }
  return result.id;
}

interface SessionFixture {
  pane: PanelDataPaneNext;
  session: QueryCoauthoringSession;
  canonical: SceneQueryRunner;
  panel: VizPanel;
  timeRange: SceneTimeRange;
  requests: Array<{ request: DataQueryRequest; subscriber: Subscriber<PanelData>; cancelled: boolean }>;
  data: (value: number, overrides?: Partial<PanelData>) => PanelData;
  finish: (index: number, value: number, overrides?: Partial<PanelData>) => void;
  select: jest.Mock;
  datasource: ReturnType<typeof getMockDataSource> & { queryCoauthoring: () => QueryCoauthoringLanguage<TextQuery> };
}

function setup(): SessionFixture {
  const datasource = Object.assign(getMockDataSource(), { queryCoauthoring: () => language });
  mockGetDataSource.mockResolvedValue(datasource);
  const timeRange = new SceneTimeRange({ from: '2026-11-01T00:00:00Z', to: '2026-11-01T01:00:00Z' });
  const data = (value: number, overrides: Partial<PanelData> = {}): PanelData => ({
    state: LoadingState.Done,
    timeRange: timeRange.state.value,
    series: ['A', 'B'].map((refId) =>
      toDataFrame({ refId, fields: [{ name: 'value', type: FieldType.number, values: [value] }] })
    ),
    ...overrides,
  });
  const canonical = new SceneQueryRunner({
    queries: original,
    datasource: { uid: 'prom' },
    data: data(1),
    runQueriesMode: 'manual',
  });
  const panel = new VizPanel({ key: 'panel-1', $data: canonical, $timeRange: timeRange });
  const pane = new PanelDataPaneNext({ panelRef: panel.getRef() });
  const requests: Array<{ request: DataQueryRequest; subscriber: Subscriber<PanelData>; cancelled: boolean }> = [];
  setRunRequest((_datasource, request) =>
    request.targets.length === 0
      ? of(data(0, { request }))
      : new Observable<PanelData>((subscriber) => {
          const run = { request, subscriber, cancelled: false };
          requests.push(run);
          return () => {
            run.cancelled = true;
          };
        })
  );
  const select = jest.fn();
  const session = pane.startCoauthoringSession('A', [], select);
  const finish = (index: number, value: number, overrides: Partial<PanelData> = {}) => {
    requests[index].subscriber.next(data(value, { request: requests[index].request, ...overrides }));
    requests[index].subscriber.complete();
  };
  return { pane, session, canonical, panel, timeRange, requests, data, finish, select, datasource };
}

beforeEach(() => {
  Object.defineProperty(navigator, 'userActivation', { configurable: true, value: { isActive: true } });
});
afterEach(() => {
  jest.restoreAllMocks();
});

it('previews all changed queries in a clone and commits the full array once, followed by one run', async () => {
  const { pane, session, canonical, requests, finish, select } = setup();
  const [result] = await session.stageProposal(
    [
      {
        changes: [
          { refId: 'A', text: 'sum(up)' },
          { refId: 'B', text: 'sum(rate(requests[5m]))' },
        ],
      },
    ],
    { baseRevision: 0 }
  );
  const id = stagedId(result);
  session.preview(id);
  await waitFor(() => expect(requests).toHaveLength(1));
  expect(canonical.state.queries).toEqual(original);
  expect(requests[0].request.targets).toMatchObject([
    { ...original[0], expr: 'sum(up)' },
    { ...original[1], expr: 'sum(rate(requests[5m]))' },
  ]);
  finish(0, 5);
  expect(canonical.state.data?.series[0].fields[0].values).toEqual([5]);
  expect(session.getState().health).toEqual({ A: 'ok', B: 'ok' });
  expect(select).toHaveBeenCalledTimes(0);
  session.select('B');
  expect(select).toHaveBeenCalledWith('B');
  expect(await session.accept(id, { baseRevision: 0 })).toEqual({ status: 'applied', revision: 1 });
  expect(canonical.state.queries).toEqual([
    { ...original[0], expr: 'sum(up)' },
    { ...original[1], expr: 'sum(rate(requests[5m]))' },
  ]);
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(session.getState()).toMatchObject({ revision: 1, step: 'apply', canUndo: true });
  pane.closeCoauthoringSession('left_panel_edit');
  canonical.cancelQuery();
});

it('returns to Review with the same Proposal on Undo and refuses Undo after a later edit', async () => {
  const { pane, session, canonical } = setup();
  const [result] = await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up)' }] }], { baseRevision: 0 });
  const id = stagedId(result);
  await session.accept(id, { baseRevision: 0 });
  expect(await session.undo({})).toEqual({ status: 'applied', revision: 2 });
  expect(canonical.state.queries).toEqual(original);
  expect(session.getState()).toMatchObject({
    step: 'review',
    previewedOption: 'original',
    canUndo: false,
    stale: false,
    proposal: [{ id }],
  });
  await session.accept(id, { baseRevision: 2 });
  pane.updateSelectedQuery(Object.assign({}, original[1], { expr: 'manual' }), 'B');
  expect(await session.undo({})).toEqual({ status: 'stale' });
  expect(session.getState()).toMatchObject({ revision: 4, canUndo: false, stale: true });
  session.exit();
  canonical.cancelQuery();
});

it('blocks errors but allows a loading Option, and enforces transient activation for Accept and Undo', async () => {
  const { session, canonical, requests, finish } = setup();
  const [result] = await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up)' }] }], { baseRevision: 0 });
  const id = stagedId(result);
  Object.defineProperty(navigator, 'userActivation', { configurable: true, value: { isActive: false } });
  expect(await session.accept(id, { baseRevision: 0 })).toEqual({ status: 'no_user_activation' });
  expect(canonical.state.queries).toEqual(original);
  Object.defineProperty(navigator, 'userActivation', { configurable: true, value: { isActive: true } });
  await waitFor(() => expect(requests).toHaveLength(1));
  finish(0, 0, { state: LoadingState.Error, errors: [{ refId: 'A', message: 'bad query' }] });
  expect(await session.accept(id, { baseRevision: 0 })).toEqual({ status: 'blocked' });
  const [replacement] = await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up) + 1' }] }], {
    baseRevision: 0,
  });
  expect(await session.accept(stagedId(replacement), { baseRevision: 0 })).toEqual({ status: 'applied', revision: 1 });
  Object.defineProperty(navigator, 'userActivation', { configurable: true, value: { isActive: false } });
  expect(await session.undo({})).toEqual({ status: 'no_user_activation' });
  expect(session.getState().step).toBe('apply');
  session.exit();
  canonical.cancelQuery();
});

it('validates options atomically, removes duplicates and no-ops, and retains agent order', async () => {
  const { session } = setup();
  const results = await session.stageProposal(
    [
      { changes: [{ refId: 'A', text: 'sum(up)' }] },
      {
        changes: [
          { refId: 'A', text: 'sum(up)' },
          { refId: 'B', text: original[1].expr },
        ],
      },
      { changes: [{ refId: 'A', text: original[0].expr }] },
    ],
    { baseRevision: 0 }
  );
  expect(results.map((result) => result.status)).toEqual(['staged', 'unchanged', 'unchanged']);
  expect(session.getState().proposal).toMatchObject([
    {
      id: stagedId(results[0]),
      diffs: [{ refId: 'A', original: 'up', proposed: 'sum(up)', editsOutsideFocus: false }],
    },
  ]);
  expect(
    await session.stageProposal(
      [
        {
          changes: [
            { refId: 'A', text: 'sum(up)' },
            { refId: 'missing', text: 'x' },
          ],
        },
      ],
      { baseRevision: 0 }
    )
  ).toEqual([{ status: 'invalid' }]);
  expect(session.getState().proposal).toEqual([]);
  expect(await session.stageProposal([{ changes: [{ refId: 'A', text: 'invalid' }] }], { baseRevision: 0 })).toEqual([
    { status: 'invalid' },
  ]);
  expect(
    await session.stageProposal(
      [
        {
          changes: [
            { refId: 'A', text: 'a' },
            { refId: 'A', text: 'b' },
          ],
        },
      ],
      { baseRevision: 0 }
    )
  ).toEqual([{ status: 'invalid' }]);
  expect(
    await session.stageProposal(
      Array.from({ length: 4 }, () => ({ changes: [{ refId: 'A', text: 'a' }] })),
      { baseRevision: 0 }
    )
  ).toEqual(Array.from({ length: 4 }, () => ({ status: 'invalid' })));
  expect(await session.stageProposal([{ changes: [{ refId: 'A', text: 'a' }] }], { baseRevision: 10 })).toEqual([
    { status: 'stale' },
  ]);
  session.exit();
});

it.each([undefined, { version: 2, describe: language.describe, prepare: language.prepare }])(
  'reports unsupported for an older or unknown language contract',
  async (contract) => {
    const { session, datasource } = setup();
    Object.assign(datasource, { queryCoauthoring: contract ? () => contract : undefined });
    expect(await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up)' }] }], { baseRevision: 0 })).toEqual([
      { status: 'unsupported' },
    ]);
    session.exit();
  }
);

it('swaps the whole option and preserves typing in one proposed row without accepting its siblings', async () => {
  const { session, pane, canonical } = setup();
  const results = await session.stageProposal(
    [
      {
        changes: [
          { refId: 'A', text: 'sum(up)' },
          { refId: 'B', text: 'sum(rate(requests[5m]))' },
        ],
      },
      { changes: [{ refId: 'B', text: 'max(rate(requests[5m]))' }] },
    ],
    { baseRevision: 0 }
  );
  session.preview(stagedId(results[0]));
  expect(pane.getCoauthoringEditorQueries()).toEqual([
    { ...original[0], expr: 'sum(up)' },
    { ...original[1], expr: 'sum(rate(requests[5m]))' },
  ]);
  session.preview(stagedId(results[1]));
  expect(pane.getCoauthoringEditorQueries()).toEqual([
    original[0],
    { ...original[1], expr: 'max(rate(requests[5m]))' },
  ]);
  pane.updateSelectedQuery(Object.assign({}, original[1], { expr: 'max(rate(requests[5m])) + 1' }), 'B');
  expect(canonical.state.queries).toEqual([original[0], { ...original[1], expr: 'max(rate(requests[5m])) + 1' }]);
  expect(session.getState()).toMatchObject({ revision: 1, step: 'review', stale: true, previewedOption: 'original' });
  expect(session.preview(stagedId(results[0]))).toEqual({ ok: false, reason: 'stale' });
  expect(await session.accept(stagedId(results[0]), { baseRevision: 1 })).toEqual({ status: 'stale' });
  session.exit();
});

it('updates revision on manual edits and Run, while ignoring preview results and time-range changes', async () => {
  const { session, pane, timeRange, requests, finish } = setup();
  const [result] = await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up)' }] }], { baseRevision: 0 });
  session.preview(stagedId(result));
  await waitFor(() => expect(requests).toHaveLength(1));
  finish(0, 0, { errors: [{ refId: 'A', message: 'preview error' }], state: LoadingState.Error });
  expect(session.getState()).toMatchObject({ revision: 0, health: { A: 'ok', B: 'ok' } });
  timeRange.onTimeRangeChange(
    new SceneTimeRange({ from: '2026-11-02T00:00:00Z', to: '2026-11-02T01:00:00Z' }).state.value
  );
  expect(session.getState()).toMatchObject({
    revision: 0,
    health: { A: 'ok', B: 'ok' },
    proposal: [{ previewOutcome: 'loading' }],
  });
  await waitFor(() => expect(requests).toHaveLength(2));
  pane.runQueries();
  expect(session.getState()).toMatchObject({ revision: 1, stale: true, previewedOption: 'original' });
  expect(requests[1].cancelled).toBe(true);
  session.exit();
});

it('test-runs in rank order with one hidden clone and never projects background data', async () => {
  const { session, panel, canonical, requests, finish } = setup();
  const results = await session.stageProposal(
    ['sum(up)', 'max(up)', 'min(up)'].map((text) => ({ changes: [{ refId: 'A', text }] })),
    { baseRevision: 0 }
  );
  session.preview(stagedId(results[0]));
  await waitFor(() => expect(requests).toHaveLength(1));
  expect(requests[0].request.targets[0]).toMatchObject({ expr: 'sum(up)' });
  expect(panel.state.$behaviors).toHaveLength(1);
  finish(0, 10);
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(requests[1].request.targets[0]).toMatchObject({ expr: 'max(up)' });
  expect(panel.state.$behaviors).toHaveLength(1);
  finish(1, 20);
  await waitFor(() => expect(requests).toHaveLength(3));
  expect(requests[2].request.targets[0]).toMatchObject({ expr: 'min(up)' });
  expect(canonical.state.data?.series[0].fields[0].values).toEqual([10]);
  finish(2, 30);
  expect(session.getState().proposal?.map((option) => option.id)).toEqual(results.map(stagedId));
  session.preview(stagedId(results[1]));
  expect(canonical.state.data?.series[0].fields[0].values).toEqual([20]);
  session.preview('original');
  session.preview(stagedId(results[0]));
  expect(canonical.state.data?.series[0].fields[0].values).toEqual([10]);
  expect(requests).toHaveLength(3);
  session.exit();
});

it.each(['exit', 'stale', 'replace', 'accept', 'range'] as const)(
  'cancels active clones on %s and ignores their late results',
  async (action) => {
    const { session, pane, panel, canonical, requests, timeRange, data } = setup();
    const results = await session.stageProposal(
      ['sum(up)', 'max(up)'].map((text) => ({ changes: [{ refId: 'A', text }] })),
      { baseRevision: 0 }
    );
    session.preview(stagedId(results[0]));
    await waitFor(() => expect(requests).toHaveLength(1));
    const old = [...requests];
    if (action === 'exit') {
      session.exit();
    }
    if (action === 'stale') {
      pane.updateSelectedQuery(Object.assign({}, original[1], { expr: 'manual' }), 'B');
    }
    if (action === 'replace') {
      await session.stageProposal([{ changes: [{ refId: 'A', text: 'min(up)' }] }], { baseRevision: 0 });
    }
    if (action === 'accept') {
      await session.accept(stagedId(results[0]), { baseRevision: 0 });
    }
    if (action === 'range') {
      timeRange.onTimeRangeChange(
        new SceneTimeRange({ from: '2026-11-03T00:00:00Z', to: '2026-11-03T01:00:00Z' }).state.value
      );
    }
    expect(old.map((run) => run.cancelled)).toEqual([true]);
    for (const run of old) {
      run.subscriber.next(data(99));
    }
    expect(canonical.state.data?.series[0].fields[0].values).toEqual([1]);
    if (action === 'exit' || action === 'stale' || action === 'accept') {
      expect(panel.state.$behaviors).toEqual([]);
    }
    session.exit();
    canonical.cancelQuery();
  }
);

it.each(['exit', 'replaced', 'left_panel_edit', 'flag_off', 'focus_removed'] as const)(
  'ends once with %s, keeps manual/accepted queries, and cannot be resumed',
  async (reason) => {
    const { session, pane, canonical } = setup();
    if (reason === 'exit') {
      session.exit();
    }
    if (reason === 'replaced') {
      pane.startCoauthoringSession('B');
    }
    if (reason === 'left_panel_edit' || reason === 'flag_off') {
      pane.closeCoauthoringSession(reason);
    }
    if (reason === 'focus_removed') {
      pane.updateSelectedQuery({ ...original[0], refId: 'renamed' }, 'A');
    }
    session.exit();
    expect(await session.closed).toBe(reason);
    expect(session.signal.aborted).toBe(true);
    expect(await session.accept('old', { baseRevision: 0 })).toEqual({ status: 'closed' });
    expect(session.getState().canUndo).toBe(false);
    expect(canonical.state.queries[0].refId).toBe(reason === 'focus_removed' ? 'renamed' : 'A');
    pane.closeCoauthoringSession('left_panel_edit');
  }
);

it('aborts superseded staging and never publishes its late result', async () => {
  const { session, datasource } = setup();
  let release!: () => void;
  let descriptionSignal: AbortSignal | undefined;
  Object.assign(datasource, {
    queryCoauthoring: () => ({
      ...language,
      describe: async (query: TextQuery, options: { signal?: AbortSignal }) => {
        descriptionSignal = options.signal;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return language.describe(query, options);
      },
    }),
  });
  const first = session.stageProposal([{ changes: [{ refId: 'A', text: 'first' }] }], { baseRevision: 0 });
  await waitFor(() => expect(descriptionSignal?.aborted).toBe(false));
  Object.assign(datasource, { queryCoauthoring: () => language });
  const [second] = await session.stageProposal([{ changes: [{ refId: 'A', text: 'second' }] }], { baseRevision: 0 });
  expect(descriptionSignal?.aborted).toBe(true);
  expect(await first).toEqual([{ status: 'stale' }]);
  release();
  expect(session.getState().proposal).toMatchObject([{ id: stagedId(second), diffs: [{ proposed: 'second' }] }]);
  session.exit();
});

it('honors already-aborted and pending AbortSignals without changing canonical queries', async () => {
  const { session, datasource, canonical } = setup();
  const abort = new AbortController();
  abort.abort();
  expect(
    await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up)' }] }], {
      baseRevision: 0,
      signal: abort.signal,
    })
  ).toEqual([{ status: 'stale' }]);
  const [result] = await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up)' }] }], { baseRevision: 0 });
  expect(await session.accept(stagedId(result), { baseRevision: 0, signal: abort.signal })).toEqual({
    status: 'aborted',
  });
  expect(await session.undo({ signal: abort.signal })).toEqual({ status: 'aborted' });
  let release!: () => void;
  Object.assign(datasource, {
    queryCoauthoring: () => ({
      ...language,
      describe: async (query: TextQuery) => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return language.describe(query, {});
      },
    }),
  });
  const pendingAbort = new AbortController();
  const pending = session.stageProposal([{ changes: [{ refId: 'B', text: 'pending' }] }], {
    baseRevision: 0,
    signal: pendingAbort.signal,
  });
  await waitFor(() => expect(typeof release).toBe('function'));
  pendingAbort.abort();
  expect(await pending).toEqual([{ status: 'stale' }]);
  release();
  expect(canonical.state.queries).toEqual(original);
  expect(session.getState().proposal).toMatchObject([{ id: stagedId(result) }]);
  session.exit();
});

it('preserves accepted queries on Exit and refuses staging in Apply', async () => {
  const { session, canonical } = setup();
  const [result] = await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up)' }] }], { baseRevision: 0 });
  await session.accept(stagedId(result), { baseRevision: 0 });
  expect(await session.stageProposal([{ changes: [{ refId: 'B', text: 'later' }] }], { baseRevision: 1 })).toEqual([
    { status: 'invalid' },
  ]);
  session.exit();
  expect(canonical.state.queries).toEqual([{ ...original[0], expr: 'sum(up)' }, original[1]]);
  expect(session.getState()).toMatchObject({ step: 'apply', canUndo: false });
  canonical.cancelQuery();
});

it('keeps canonical health independent of error previews, then derives new health on Accept and Undo', async () => {
  const { session, canonical, requests, finish, data } = setup();
  const [result] = await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up)' }] }], { baseRevision: 0 });
  session.preview(stagedId(result));
  await waitFor(() => expect(requests).toHaveLength(1));
  finish(0, 0, { errors: [{ refId: 'A', message: 'preview error' }], state: LoadingState.Error });
  expect(session.getState().health).toEqual({ A: 'ok', B: 'ok' });
  canonical.setState({
    data: data(1, { errors: [{ refId: 'B', message: 'canonical failure' }], state: LoadingState.Error }),
  });
  expect(session.getState().health).toEqual({ A: 'ok', B: 'error' });
  const [next] = await session.stageProposal([{ changes: [{ refId: 'A', text: 'max(up)' }] }], { baseRevision: 0 });
  await session.accept(stagedId(next), { baseRevision: 0 });
  await waitFor(() => expect(requests.some((request) => request.request.targets[0].refId === 'A')).toBe(true));
  canonical.setState({ data: data(0) });
  expect(session.getState().health).toEqual({ A: 'no-signal', B: 'no-signal' });
  await session.undo({});
  canonical.setState({ data: data(2) });
  expect(session.getState().health).toEqual({ A: 'ok', B: 'ok' });
  session.exit();
  canonical.cancelQuery();
});

it.each([
  { name: 'add', change: (queries: DataQuery[]) => [...queries, { refId: 'C' }] },
  { name: 'remove sibling', change: (queries: DataQuery[]) => queries.slice(0, 1) },
  { name: 'reorder', change: (queries: DataQuery[]) => [...queries].reverse() },
  {
    name: 'datasource change',
    change: (queries: DataQuery[]) => queries.map((query) => ({ ...query, datasource: { uid: 'other' } })),
  },
])('advances revision and stales the Proposal on $name', async ({ change }) => {
  const { session, canonical } = setup();
  await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up)' }] }], { baseRevision: 0 });
  canonical.setState({ queries: change(canonical.state.queries) });
  expect(session.getState()).toMatchObject({ revision: 1, stale: true });
  expect(session.signal.aborted).toBe(false);
  session.exit();
});

it('keeps snapshots isolated from consumers and allows a fresh Proposal at the new revision', async () => {
  const { session, canonical, pane } = setup();
  const snapshot = session.getState();
  snapshot.queries[0].refId = 'mutated';
  snapshot.health.A = 'error';
  expect(session.getState()).toMatchObject({ queries: [{ refId: 'A' }, { refId: 'B' }], health: { A: 'ok', B: 'ok' } });
  pane.updateSelectedQuery(Object.assign({}, original[0], { expr: 'manual' }), 'A');
  const [result] = await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(manual)' }] }], {
    baseRevision: 1,
  });
  expect(result).toMatchObject({ status: 'staged', diffs: [{ original: 'manual', proposed: 'sum(manual)' }] });
  expect(await session.accept(stagedId(result), { baseRevision: 1 })).toEqual({ status: 'applied', revision: 2 });
  expect(canonical.state.queries[0]).toMatchObject({ expr: 'sum(manual)' });
  session.exit();
  canonical.cancelQuery();
});

it('keeps selected preview data on screen when canonical results arrive, while updating canonical health', async () => {
  const { session, canonical, requests, finish, data } = setup();
  const [result] = await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up)' }] }], { baseRevision: 0 });
  session.preview(stagedId(result));
  await waitFor(() => expect(requests).toHaveLength(1));
  finish(0, 7);
  canonical.setState({
    data: data(2, { state: LoadingState.Error, errors: [{ refId: 'B', message: 'canonical failure' }] }),
  });
  expect(session.getState().health).toEqual({ A: 'ok', B: 'error' });
  expect(canonical.state.data?.series[0].fields[0].values).toEqual([7]);
  session.preview('original');
  expect(canonical.state.data?.series[0].fields[0].values).toEqual([2]);
  expect(session.getState().health).toEqual({ A: 'ok', B: 'error' });
  session.exit();
});

it('reuses completed Option results in Apply, then clears them and reruns after a time-range change', async () => {
  const { session, canonical, requests, finish, timeRange } = setup();
  const results = await session.stageProposal(
    ['sum(up)', 'max(up)'].map((text) => ({ changes: [{ refId: 'A', text }] })),
    { baseRevision: 0 }
  );
  await waitFor(() => expect(requests).toHaveLength(1));
  finish(0, 10);
  await waitFor(() => expect(requests).toHaveLength(2));
  finish(1, 20);
  await session.accept(stagedId(results[0]), { baseRevision: 0 });
  await waitFor(() => expect(requests).toHaveLength(3));
  finish(2, 10);
  session.preview(stagedId(results[1]));
  expect(canonical.state.data?.series[0].fields[0].values).toEqual([20]);
  expect(requests).toHaveLength(3);
  expect(session.getState()).toMatchObject({ step: 'apply', canUndo: false });
  expect(await session.undo({})).toEqual({ status: 'invalid' });
  timeRange.onTimeRangeChange(
    new SceneTimeRange({ from: '2026-11-04T00:00:00Z', to: '2026-11-04T01:00:00Z' }).state.value
  );
  expect(session.getState()).toMatchObject({
    revision: 1,
    proposal: [{ previewOutcome: 'loading' }, { previewOutcome: 'loading' }],
  });
  await waitFor(() => expect(requests).toHaveLength(4));
  expect(requests[3].request.targets[0]).toMatchObject({ expr: 'max(up)' });
  finish(3, 21);
  expect(canonical.state.data?.series[0].fields[0].values).toEqual([21]);
  session.exit();
  canonical.cancelQuery();
});

it('prioritizes a newly selected Option after the current run and never leaves two off-screen clones', async () => {
  const { session, panel, canonical, requests, finish } = setup();
  const results = await session.stageProposal(
    ['sum(up)', 'max(up)', 'min(up)'].map((text) => ({ changes: [{ refId: 'A', text }] })),
    { baseRevision: 0 }
  );
  session.preview(stagedId(results[0]));
  await waitFor(() => expect(requests).toHaveLength(1));
  session.preview(stagedId(results[2]));
  expect(panel.state.$behaviors).toHaveLength(1);
  expect(session.getState().proposal?.[2].previewOutcome).toBe('loading');
  finish(0, 10);
  expect(canonical.state.data?.series[0].fields[0].values).toEqual([1]);
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(requests[1].request.targets[0]).toMatchObject({ expr: 'min(up)' });
  session.preview('original');
  finish(1, 30);
  await waitFor(() => expect(requests).toHaveLength(3));
  expect(requests[2].request.targets[0]).toMatchObject({ expr: 'max(up)' });
  expect(panel.state.$behaviors).toHaveLength(1);
  expect(canonical.state.data?.series[0].fields[0].values).toEqual([1]);
  finish(2, 20);
  session.preview(stagedId(results[2]));
  expect(canonical.state.data?.series[0].fields[0].values).toEqual([30]);
  expect(requests).toHaveLength(3);
  session.exit();
});

it('retains cached frame values after the panel clears projected arrays', async () => {
  const { session, canonical, requests, finish } = setup();
  const [result] = await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up)' }] }], { baseRevision: 0 });
  session.preview(stagedId(result));
  await waitFor(() => expect(requests).toHaveLength(1));
  finish(0, 7);
  canonical.state.data!.series[0].fields[0].values.length = 0;
  session.preview('original');
  expect(canonical.state.data?.series[0].fields[0].values).toEqual([1]);
  session.preview(stagedId(result));
  expect(canonical.state.data?.series[0].fields[0].values).toEqual([7]);
  expect(requests).toHaveLength(1);
  session.exit();
});

it.each(['preview', 'undo'] as const)(
  'invalidates the cache on a time-range change while Apply shows Original before %s',
  async (action) => {
    const { session, canonical, requests, finish, timeRange } = setup();
    const results = await session.stageProposal(
      ['sum(up)', 'max(up)'].map((text) => ({ changes: [{ refId: 'A', text }] })),
      { baseRevision: 0 }
    );
    await waitFor(() => expect(requests).toHaveLength(1));
    finish(0, 10);
    await waitFor(() => expect(requests).toHaveLength(2));
    finish(1, 20);
    await session.accept(stagedId(results[0]), { baseRevision: 0 });
    await waitFor(() => expect(requests).toHaveLength(3));
    finish(2, 10);
    timeRange.onTimeRangeChange(
      new SceneTimeRange({ from: '2026-11-05T00:00:00Z', to: '2026-11-05T01:00:00Z' }).state.value
    );
    expect(session.getState()).toMatchObject({
      revision: 1,
      previewedOption: 'original',
      proposal: [{ previewOutcome: 'loading' }, { previewOutcome: 'loading' }],
    });
    if (action === 'preview') {
      session.preview(stagedId(results[1]));
      await waitFor(() => expect(requests).toHaveLength(4));
      expect(requests[3].request.targets[0]).toMatchObject({ expr: 'max(up)' });
      finish(3, 21);
      expect(canonical.state.data?.series[0].fields[0].values).toEqual([21]);
    } else {
      expect(await session.undo({})).toEqual({ status: 'applied', revision: 2 });
      await waitFor(() => expect(requests).toHaveLength(5));
      expect(requests.slice(3).map((run) => run.request.targets[0])).toMatchObject([
        { expr: 'up' },
        { expr: 'sum(up)' },
      ]);
    }
    session.exit();
    canonical.cancelQuery();
  }
);

it('includes whitespace edits when computing UTF-16 ranges for staged diffs', async () => {
  const { session } = setup();
  const [result] = await session.stageProposal([{ changes: [{ refId: 'A', text: ' up + 1' }] }], { baseRevision: 0 });
  expect(result).toMatchObject({
    status: 'staged',
    diffs: [
      {
        refId: 'A',
        original: 'up',
        proposed: ' up + 1',
        originalRanges: [
          { from: 0, to: 0 },
          { from: 2, to: 2 },
        ],
        proposedRanges: [
          { from: 0, to: 1 },
          { from: 3, to: 7 },
        ],
        editsOutsideFocus: false,
      },
    ],
  });
  session.exit();
});

it('retains latest canonical health for unchanged queries and leaves a newly added query unknown until it runs', () => {
  const { session, canonical, data } = setup();
  canonical.setState({
    data: data(1, { errors: [{ refId: 'A', message: 'canonical failure' }], state: LoadingState.Error }),
  });
  canonical.setState({ queries: [...canonical.state.queries, { refId: 'C' }] });
  expect(session.getState().health).toEqual({ A: 'error', B: 'ok', C: 'unknown' });
  session.exit();
});
