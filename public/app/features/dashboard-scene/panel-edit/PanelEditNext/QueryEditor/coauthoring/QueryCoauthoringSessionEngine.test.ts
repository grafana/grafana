import { waitFor } from '@testing-library/react';
import { Observable, of, type Subscriber } from 'rxjs';

import {
  AlertState,
  type DataQuery,
  type DataQueryRequest,
  FieldType,
  LoadingState,
  type PanelData,
  toDataFrame,
} from '@grafana/data';
import { logError, setRunRequest } from '@grafana/runtime';
import { ConstantVariable, SceneVariableSet, SceneQueryRunner, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { getMockDataSource } from 'app/features/query/state/mocks/mockDataSource';

import { PanelDataPaneNext } from '../../PanelDataPaneNext';

import { QueryCoauthoringSessionEngine } from './QueryCoauthoringSessionEngine';
import {
  type QueryCoauthoringLanguage,
  type QueryCoauthoringSession,
  type QueryCoauthoringStageResult,
} from './queryCoauthoringContracts';

const mockGetDataSource = jest.fn();
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  logError: jest.fn(),
  getDataSourceSrv: () => ({ get: mockGetDataSource }),
  getDataSourceInstance: (...args: unknown[]) => mockGetDataSource(...args),
  getDataSourceInstanceSettings: async () => undefined,
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
  getQuerySupport: () => ({ editable: true }),
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

const cleanups: Array<() => void> = [];

function setup(ranges: Array<{ from: number; to: number }> = []): SessionFixture {
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
  const session = pane.startCoauthoringSession('A', ranges, select, undefined, {
    refId: 'A',
    revision: 0,
    contextGeneration: 0,
    ranges,
    status: 'ready',
    text: 'up',
  });
  cleanups.push(() => {
    session.exit();
    QueryCoauthoringSessionEngine.get(panel)?.dispose();
    canonical.cancelQuery();
  });
  const finish = (index: number, value: number, overrides: Partial<PanelData> = {}) => {
    requests[index].subscriber.next(data(value, { request: requests[index].request, ...overrides }));
    requests[index].subscriber.complete();
  };
  return { pane, session, canonical, panel, timeRange, requests, data, finish, select, datasource };
}

beforeEach(() => {
  jest.mocked(logError).mockClear();
  Object.defineProperty(navigator, 'userActivation', { configurable: true, value: { isActive: true } });
});
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) {
    cleanup();
  }
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
    { baseContextGeneration: session.getState().contextGeneration, baseRevision: 0 }
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
  const [result] = await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up)' }] }], {
    baseContextGeneration: session.getState().contextGeneration,
    baseRevision: 0,
  });
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

it.each(['original', 'option'] as const)(
  'advances revision on explicit Run after Accept while previewing %s without losing Undo',
  async (preview) => {
    const { pane, session, canonical, data } = setup();
    const [result] = await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up)' }] }], {
      baseContextGeneration: session.getState().contextGeneration,
      baseRevision: 0,
    });
    await session.accept(stagedId(result), { baseRevision: 0 });
    canonical.setState({ data: data(2) });
    expect(session.getState()).toMatchObject({ revision: 1, step: 'apply', canUndo: true });
    if (preview === 'option') {
      session.preview(stagedId(result));
    }

    pane.runQueries();

    expect(session.getState()).toMatchObject({ revision: 2, step: 'apply', canUndo: true, stale: true });
    expect(await session.undo({})).toEqual({ status: 'applied', revision: 3 });
    expect(canonical.state.queries).toEqual(original);
    const [next] = await session.stageProposal([{ changes: [{ refId: 'A', text: 'max(up)' }] }], {
      baseContextGeneration: session.getState().contextGeneration,
      baseRevision: 3,
    });
    expect(next.status).toBe('staged');
    session.exit();
    canonical.cancelQuery();
  }
);

it.each(['original', 'option'] as const)('allows staging after an Apply edit while previewing %s', async (preview) => {
  const { pane, session, canonical } = setup();
  const [result] = await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up)' }] }], {
    baseContextGeneration: session.getState().contextGeneration,
    baseRevision: 0,
  });
  const id = stagedId(result);
  await session.accept(id, { baseRevision: 0 });
  if (preview === 'option') {
    session.preview(id);
  }
  const edited = { ...original[1], expr: 'manual' };
  pane.updateSelectedQuery(edited, 'B');

  expect(session.getState()).toMatchObject({
    step: 'review',
    stale: true,
    canUndo: false,
    previewedOption: 'original',
  });
  expect(await session.undo({})).toEqual({ status: 'stale' });
  const [next] = await session.stageProposal([{ changes: [{ refId: 'A', text: 'max(up)' }] }], {
    baseContextGeneration: session.getState().contextGeneration,
    baseRevision: 2,
  });
  expect(next.status).toBe('staged');
  expect(canonical.state.queries).toEqual([
    { ...original[0], expr: 'sum(up)' },
    { ...original[1], expr: 'manual' },
  ]);
  session.exit();
  canonical.cancelQuery();
});

it.each(['missing', 'loading'] as const)('restores %s Original data after preview', async (initial) => {
  const { session, canonical, requests, finish, data } = setup();
  canonical.setState({
    data: initial === 'missing' ? undefined : data(0, { state: LoadingState.Loading, series: [] }),
  });
  const [result] = await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up)' }] }], {
    baseContextGeneration: session.getState().contextGeneration,
    baseRevision: 0,
  });
  session.preview(stagedId(result));
  await waitFor(() => expect(requests.length).toBe(1));
  finish(0, 5);
  expect(canonical.state.data?.series[0].fields[0].values).toEqual([5]);

  session.preview('original');

  expect(canonical.state.data?.series).toEqual(initial === 'missing' ? undefined : []);
  expect(canonical.state.data?.state).toBe(initial === 'missing' ? undefined : LoadingState.Loading);
  expect(session.getState().health).toEqual({ A: 'unknown', B: 'unknown' });
  session.exit();
});

it.each(['original', 'exit'] as const)(
  'keeps canonical health and restores Original after annotation updates on %s',
  async (action) => {
    const { session, canonical, requests, finish } = setup();
    const [result] = await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up)' }] }], {
      baseContextGeneration: session.getState().contextGeneration,
      baseRevision: 0,
    });
    session.preview(stagedId(result));
    await waitFor(() => expect(requests.length).toBe(1));
    finish(0, 0, { state: LoadingState.Error, errors: [{ refId: 'A', message: 'preview error' }] });
    canonical.setState({ data: { ...canonical.state.data!, annotations: [toDataFrame({ fields: [] })] } });

    expect(session.getState().health).toEqual({ A: 'ok', B: 'ok' });
    if (action === 'original') {
      session.preview('original');
    } else {
      session.exit();
    }
    expect(canonical.state.data?.series[0].fields[0].values).toEqual([1]);
    expect(canonical.state.data?.errors).toBeUndefined();
    session.exit();
  }
);

it.each(['original', 'exit'] as const)(
  'retains layer updates received while Original is visible through %s',
  async (action) => {
    const { session, canonical, requests, finish } = setup();
    const [result] = await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up)' }] }], {
      baseContextGeneration: session.getState().contextGeneration,
      baseRevision: 0,
    });
    canonical.setState({
      data: {
        ...canonical.state.data!,
        annotations: [
          toDataFrame({ fields: [{ name: 'text', type: FieldType.string, values: ['fresh annotation'] }] }),
        ],
        alertState: { id: 1, dashboardUID: 'dashboard', panelId: 1, state: AlertState.Alerting },
      },
    });
    expect(canonical.state.data?.annotations?.[0].fields[0].values).toEqual(['fresh annotation']);

    if (action === 'original') {
      session.preview(stagedId(result));
      await waitFor(() => expect(requests.length).toBe(1));
      finish(0, 5);
      expect(canonical.state.data?.series[0].fields[0].values).toEqual([5]);
      session.preview('original');
    } else {
      session.exit();
    }

    expect(canonical.state.data?.series[0].fields[0].values).toEqual([1]);
    expect(canonical.state.data?.annotations?.[0].fields[0].values).toEqual(['fresh annotation']);
    expect(canonical.state.data?.alertState?.state).toBe(AlertState.Alerting);
    expect(session.getState().health).toEqual({ A: 'ok', B: 'ok' });
  }
);

it.each(['replace-range', 'maxDataPoints', 'minInterval'] as const)(
  'invalidates cached Options after %s changes without advancing revision',
  async (change) => {
    const { session, panel, canonical, requests, finish } = setup();
    const [result] = await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up)' }] }], {
      baseContextGeneration: session.getState().contextGeneration,
      baseRevision: 0,
    });
    session.preview(stagedId(result));
    await waitFor(() => expect(requests.length).toBe(1));
    finish(0, 5);
    if (change === 'replace-range') {
      panel.setState({ $timeRange: new SceneTimeRange({ from: '2026-11-02T00:00:00Z', to: '2026-11-02T01:00:00Z' }) });
    } else {
      canonical.setState(change === 'maxDataPoints' ? { maxDataPoints: 42 } : { minInterval: '30s' });
    }
    expect(session.getState()).toMatchObject({ revision: 0, proposal: [{ previewOutcome: 'loading' }] });
    await waitFor(() => expect(requests.length).toBe(2));
    finish(1, 6);
    expect(canonical.state.data?.series[0].fields[0].values).toEqual([6]);
    if (change === 'replace-range') {
      panel.state.$timeRange!.onTimeRangeChange(
        new SceneTimeRange({ from: '2026-11-03T00:00:00Z', to: '2026-11-03T01:00:00Z' }).state.value
      );
      await waitFor(() => expect(requests.length).toBe(3));
    }
    session.exit();
  }
);

it('blocks errors but allows a loading Option, and enforces transient activation for Accept and Undo', async () => {
  const { session, canonical, requests, finish } = setup();
  const [result] = await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up)' }] }], {
    baseContextGeneration: session.getState().contextGeneration,
    baseRevision: 0,
  });
  const id = stagedId(result);
  Object.defineProperty(navigator, 'userActivation', { configurable: true, value: { isActive: false } });
  expect(await session.accept(id, { baseRevision: 0 })).toEqual({ status: 'no_user_activation' });
  expect(canonical.state.queries).toEqual(original);
  Object.defineProperty(navigator, 'userActivation', { configurable: true, value: { isActive: true } });
  await waitFor(() => expect(requests).toHaveLength(1));
  finish(0, 0, { state: LoadingState.Error, errors: [{ refId: 'A', message: 'bad query' }] });
  expect(await session.accept(id, { baseRevision: 0 })).toEqual({ status: 'blocked' });
  const [replacement] = await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up) + 1' }] }], {
    baseContextGeneration: session.getState().contextGeneration,
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
    { baseContextGeneration: session.getState().contextGeneration, baseRevision: 0 }
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
      { baseContextGeneration: session.getState().contextGeneration, baseRevision: 0 }
    )
  ).toEqual([{ status: 'invalid', issue: { kind: 'invalid_change', refId: 'missing' } }]);
  expect(session.getState().proposal).toEqual([]);
  expect(
    await session.stageProposal([{ changes: [{ refId: 'A', text: 'invalid' }] }], {
      baseContextGeneration: session.getState().contextGeneration,
      baseRevision: 0,
    })
  ).toEqual([{ status: 'invalid', issue: { kind: 'invalid_text', refId: 'A' } }]);
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
      { baseContextGeneration: session.getState().contextGeneration, baseRevision: 0 }
    )
  ).toEqual([{ status: 'invalid', issue: { kind: 'invalid_change', refId: 'A' } }]);
  expect(
    await session.stageProposal(
      Array.from({ length: 4 }, () => ({ changes: [{ refId: 'A', text: 'a' }] })),
      { baseContextGeneration: session.getState().contextGeneration, baseRevision: 0 }
    )
  ).toEqual(Array.from({ length: 4 }, () => ({ status: 'invalid', issue: { kind: 'invalid_change' } })));
  expect(
    await session.stageProposal([{ changes: [{ refId: 'A', text: 'a' }] }], {
      baseContextGeneration: session.getState().contextGeneration,
      baseRevision: 10,
    })
  ).toEqual([{ status: 'stale' }]);
  session.exit();
});

it.each([undefined, { version: 2, describe: language.describe, prepare: language.prepare }])(
  'reports unsupported for an older or unknown language contract',
  async (contract) => {
    const { session, datasource } = setup();
    Object.assign(datasource, { queryCoauthoring: contract ? () => contract : undefined });
    expect(
      await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up)' }] }], {
        baseContextGeneration: session.getState().contextGeneration,
        baseRevision: 0,
      })
    ).toEqual([
      {
        status: 'unsupported',
        issue: { kind: contract ? 'unsupported_language_version' : 'missing_language', refId: 'A' },
      },
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
    { baseContextGeneration: session.getState().contextGeneration, baseRevision: 0 }
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
  const [result] = await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up)' }] }], {
    baseContextGeneration: session.getState().contextGeneration,
    baseRevision: 0,
  });
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
    { baseContextGeneration: session.getState().contextGeneration, baseRevision: 0 }
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
      { baseContextGeneration: session.getState().contextGeneration, baseRevision: 0 }
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
      await session.stageProposal([{ changes: [{ refId: 'A', text: 'min(up)' }] }], {
        baseContextGeneration: session.getState().contextGeneration,
        baseRevision: 0,
      });
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
  let blockDescription = true;
  Object.assign(datasource, {
    queryCoauthoring: () => ({
      ...language,
      describe: async (query: TextQuery, options: { signal?: AbortSignal }) => {
        if (blockDescription) {
          descriptionSignal = options.signal;
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
        return language.describe(query, options);
      },
    }),
  });
  const first = session.stageProposal([{ changes: [{ refId: 'A', text: 'first' }] }], {
    baseContextGeneration: session.getState().contextGeneration,
    baseRevision: 0,
  });
  await waitFor(() => expect(descriptionSignal?.aborted).toBe(false));
  blockDescription = false;
  const [second] = await session.stageProposal([{ changes: [{ refId: 'A', text: 'second' }] }], {
    baseContextGeneration: session.getState().contextGeneration,
    baseRevision: 0,
  });
  expect(descriptionSignal?.aborted).toBe(true);
  expect(await first).toEqual([{ status: 'aborted' }]);
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
      baseContextGeneration: session.getState().contextGeneration,
      baseRevision: 0,
      signal: abort.signal,
    })
  ).toEqual([{ status: 'aborted' }]);
  let release!: () => void;
  let blockDescription = false;
  Object.assign(datasource, {
    queryCoauthoring: () => ({
      ...language,
      describe: async (query: TextQuery) => {
        if (blockDescription) {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
        return language.describe(query, { signal: new AbortController().signal });
      },
    }),
  });
  const [result] = await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up)' }] }], {
    baseContextGeneration: session.getState().contextGeneration,
    baseRevision: 0,
  });
  expect(await session.accept(stagedId(result), { baseRevision: 0, signal: abort.signal })).toEqual({
    status: 'aborted',
  });
  expect(await session.undo({ signal: abort.signal })).toEqual({ status: 'aborted' });
  blockDescription = true;
  const pendingAbort = new AbortController();
  const pending = session.stageProposal([{ changes: [{ refId: 'B', text: 'pending' }] }], {
    baseContextGeneration: session.getState().contextGeneration,
    baseRevision: 0,
    signal: pendingAbort.signal,
  });
  await waitFor(() => expect(typeof release).toBe('function'));
  pendingAbort.abort();
  expect(await pending).toEqual([{ status: 'aborted' }]);
  release();
  expect(canonical.state.queries).toEqual(original);
  expect(session.getState().proposal).toMatchObject([{ id: stagedId(result) }]);
  session.exit();
});

it('preserves accepted queries on Exit and refuses staging in Apply', async () => {
  const { session, canonical } = setup();
  const [result] = await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up)' }] }], {
    baseContextGeneration: session.getState().contextGeneration,
    baseRevision: 0,
  });
  await session.accept(stagedId(result), { baseRevision: 0 });
  expect(
    await session.stageProposal([{ changes: [{ refId: 'B', text: 'later' }] }], {
      baseContextGeneration: session.getState().contextGeneration,
      baseRevision: 1,
    })
  ).toEqual([{ status: 'invalid', issue: { kind: 'invalid_change' } }]);
  session.exit();
  expect(canonical.state.queries).toEqual([{ ...original[0], expr: 'sum(up)' }, original[1]]);
  expect(session.getState()).toMatchObject({ step: 'apply', canUndo: false });
  canonical.cancelQuery();
});

it('keeps canonical health independent of error previews, then derives new health on Accept and Undo', async () => {
  const { session, canonical, requests, finish, data } = setup();
  const [result] = await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up)' }] }], {
    baseContextGeneration: session.getState().contextGeneration,
    baseRevision: 0,
  });
  session.preview(stagedId(result));
  await waitFor(() => expect(requests).toHaveLength(1));
  finish(0, 0, { errors: [{ refId: 'A', message: 'preview error' }], state: LoadingState.Error });
  expect(session.getState().health).toEqual({ A: 'ok', B: 'ok' });
  canonical.setState({
    data: data(1, { errors: [{ refId: 'B', message: 'canonical failure' }], state: LoadingState.Error }),
  });
  expect(session.getState().health).toEqual({ A: 'ok', B: 'error' });
  const [next] = await session.stageProposal([{ changes: [{ refId: 'A', text: 'max(up)' }] }], {
    baseContextGeneration: session.getState().contextGeneration,
    baseRevision: 0,
  });
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
  await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up)' }] }], {
    baseContextGeneration: session.getState().contextGeneration,
    baseRevision: 0,
  });
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
    baseContextGeneration: session.getState().contextGeneration,
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
  const [result] = await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up)' }] }], {
    baseContextGeneration: session.getState().contextGeneration,
    baseRevision: 0,
  });
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
    { baseContextGeneration: session.getState().contextGeneration, baseRevision: 0 }
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
    { baseContextGeneration: session.getState().contextGeneration, baseRevision: 0 }
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
  const [result] = await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up)' }] }], {
    baseContextGeneration: session.getState().contextGeneration,
    baseRevision: 0,
  });
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
      { baseContextGeneration: session.getState().contextGeneration, baseRevision: 0 }
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
  const [result] = await session.stageProposal([{ changes: [{ refId: 'A', text: ' up + 1' }] }], {
    baseContextGeneration: session.getState().contextGeneration,
    baseRevision: 0,
  });
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

function setupContext(ranges: Array<{ from: number; to: number }> = []) {
  const fixture = setup(ranges);
  const engine = QueryCoauthoringSessionEngine.getOrCreate(fixture.panel);
  const session = fixture.session;
  const stage = (refId = 'B', text = 'sum(up)') =>
    session.stageProposal([{ changes: [{ refId, text }] }], {
      baseRevision: session.getState().revision,
      baseContextGeneration: session.getState().contextGeneration,
    });
  return { ...fixture, session, engine, stage };
}

it('reads inherited datasource context on demand with panel scope and authoritative editability', async () => {
  const { session } = setupContext();
  const result = await session.getContext({ baseRevision: 0 });
  expect(result).toMatchObject({
    status: 'ready',
    revision: 0,
    contextGeneration: 0,
    queries: [
      {
        refId: 'A',
        dependencies: [],
        editability: { kind: 'editable' },
        description: { status: 'ready', value: { text: 'up' } },
      },
      {
        refId: 'B',
        dependencies: [],
        editability: { kind: 'editable' },
        description: { status: 'ready', value: { text: 'rate(requests[5m])' } },
      },
    ],
    entry: { text: 'up', matchesCurrentText: true },
  });
  expect(mockGetDataSource).toHaveBeenCalledWith(
    { uid: 'prom' },
    expect.objectContaining({ __sceneObject: expect.anything() })
  );
});

it.each([
  ['false', () => ({ editable: false }), 'rejected', 'read_only'],
  ['absent', undefined, 'rejected', 'unknown_editability'],
  ['nonfunction', true, 'failed', 'support_check_failed'],
  [
    'throws',
    () => {
      throw new Error('support');
    },
    'failed',
    'support_check_failed',
  ],
  ['null', () => null, 'failed', 'support_check_failed'],
  ['array', () => [], 'failed', 'support_check_failed'],
  ['missing editable', () => ({}), 'failed', 'support_check_failed'],
  ['nonboolean', () => ({ editable: 'true' }), 'failed', 'support_check_failed'],
])(
  'keeps descriptions for %s support and refuses staging without prepare',
  async (_name, getQuerySupport, status, kind) => {
    const { session, datasource, stage } = setupContext();
    const prepare = jest.fn(language.prepare);
    datasource.queryCoauthoring = () =>
      ({ ...language, getQuerySupport, prepare }) as QueryCoauthoringLanguage<TextQuery>;
    expect(await session.getContext({ baseRevision: 0 })).toMatchObject({
      status: 'ready',
      queries: [
        { refId: 'A', description: { status: 'ready' } },
        { refId: 'B', description: { status: 'ready' } },
      ],
    });
    expect(await stage()).toEqual([{ status, issue: { kind, refId: 'B' } }]);
    expect(prepare).toHaveBeenCalledTimes(0);
  }
);

it.each([
  ['missing language', undefined, 'unsupported', 'missing_language'],
  ['unknown version', { version: 44 }, 'unsupported', 'unsupported_language_version'],
  ['malformed language', { version: 1 }, 'failed', 'language_resolution_failed'],
  ['missing version', {}, 'failed', 'language_resolution_failed'],
])('identifies the later query for %s', async (_name, adapter, status, kind) => {
  const { datasource, stage } = setupContext();
  datasource.queryCoauthoring = () => adapter as QueryCoauthoringLanguage<TextQuery>;
  expect(await stage()).toEqual([{ status, issue: { kind, refId: 'B' } }]);
});

it('separates invalid text, unchanged text and operational preparation failure with exact refId', async () => {
  const { stage, datasource } = setupContext();
  expect(await stage('B', 'invalid')).toEqual([{ status: 'invalid', issue: { kind: 'invalid_text', refId: 'B' } }]);
  expect(await stage('B', original[1].expr)).toEqual([{ status: 'unchanged' }]);
  datasource.queryCoauthoring = () => ({
    ...language,
    getQuerySupport: () => ({ editable: true }),
    prepare: () => {
      throw new Error('failed');
    },
  });
  expect(await stage()).toEqual([{ status: 'stale' }]);
  expect(await stage()).toEqual([{ status: 'failed', issue: { kind: 'preparation_failed', refId: 'B' } }]);
});

it('stages a full typed query and retains private preview/accept/undo behavior', async () => {
  const { session, stage, canonical, finish, requests } = setupContext();
  const [result] = await stage('A', 'sum(up)');
  expect(result.status).toBe('staged');
  if (result.status !== 'staged') {
    throw new Error('Expected staged');
  }
  expect(session.preview(result.id)).toEqual({ ok: true });
  await waitFor(() => expect(requests).toHaveLength(1));
  finish(0, 5);
  expect(await session.accept(result.id, { baseRevision: 0 })).toEqual({ status: 'applied', revision: 1 });
  expect(canonical.state.queries[0]).toEqual({ refId: 'A', expr: 'sum(up)', legendFormat: 'requests' });
  expect(await session.undo({})).toEqual({ status: 'applied', revision: 2 });
  expect(canonical.state.queries).toEqual(original);
});

it('uses resolver generations without fake query edits and refuses obsolete staging', async () => {
  const { session, timeRange } = setupContext();
  const before = session.getState();
  timeRange.setState({ from: '2026-11-02T00:00:00Z', to: '2026-11-02T01:00:00Z' });
  expect(session.getState()).toMatchObject({
    revision: before.revision,
    contextGeneration: before.contextGeneration + 1,
  });
  expect(
    await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up)' }] }], {
      baseRevision: before.revision,
      baseContextGeneration: before.contextGeneration,
    })
  ).toEqual([{ status: 'stale' }]);
});

it('fences late descriptions and preparation when resolver context changes', async () => {
  const { session, datasource, timeRange, stage } = setupContext();
  let resolve!: (value: Awaited<ReturnType<typeof language.describe>>) => void;
  const prepare = jest.fn(language.prepare);
  datasource.queryCoauthoring = () => ({
    ...language,
    getQuerySupport: () => ({ editable: true }),
    prepare,
    describe: () =>
      new Promise((done) => {
        resolve = done;
      }),
  });
  const reading = session.getContext({ baseRevision: 0 });
  await waitFor(() => expect(typeof resolve).toBe('function'));
  timeRange.setState({ from: '2026-11-03T00:00:00Z', to: '2026-11-03T01:00:00Z' });
  resolve({ text: 'up', language: { id: 'promql', displayName: 'PromQL' } });
  // The next query must not keep obsolete work alive.
  datasource.queryCoauthoring = () => ({ ...language, getQuerySupport: () => ({ editable: true }) });
  expect(await reading).toMatchObject({ status: 'stale', currentRevision: 0 });
  const staging = stage();
  expect((await staging)[0].status).toBe('staged');
  expect(prepare).toHaveBeenCalledTimes(0);
});

it('aborts pending context promptly and treats Exit as terminal', async () => {
  const { session, datasource } = setupContext();
  datasource.queryCoauthoring = () => ({ ...language, describe: () => new Promise(() => {}) });
  const controller = new AbortController();
  const read = session.getContext({ baseRevision: 0, signal: controller.signal });
  controller.abort();
  expect(await read).toEqual({ status: 'aborted' });
  session.exit();
  expect(await session.getContext({ baseRevision: 0 })).toEqual({ status: 'closed' });
  expect(
    await session.stageProposal([{ changes: [{ refId: 'B', text: 'up' }] }], {
      baseRevision: 0,
      baseContextGeneration: session.getState().contextGeneration,
    })
  ).toEqual([{ status: 'closed' }]);
});

it('retains a selected entry baseline and rejects verified mismatch without broadening its ranges', async () => {
  const { session, canonical, stage } = setupContext([{ from: 0, to: 2 }]);
  canonical.setState({ queries: [{ ...original[0], expr: 'new_text' }, original[1]] });
  expect(await session.getContext({ baseRevision: 1 })).toMatchObject({
    status: 'ready',
    entry: { text: 'up', revision: 0, ranges: [{ from: 0, to: 2 }], matchesCurrentText: false },
  });
  expect(await stage('A')).toEqual([{ status: 'rejected', issue: { kind: 'entry_ranges_changed', refId: 'A' } }]);
});

it('reports unscoped canonical errors at panel scope and direct expression dependencies', () => {
  const { session, canonical, data } = setupContext();
  canonical.setState({
    queries: [
      original[0],
      {
        refId: 'B',
        datasource: { uid: '__expr__', type: '__expr__' },
        type: 'math',
        expression: '$A + 1',
      } as DataQuery,
    ],
    data: data(1, { series: [], error: { message: 'transport unavailable' }, errors: undefined }),
  });
  expect(session.getState()).toMatchObject({
    dependencies: { A: [], B: ['A'] },
    health: { A: 'unknown', B: 'unknown' },
    problems: [{ scope: 'panel', kind: 'error', message: 'transport unavailable' }],
  });
});

it.each(['context', 'stage'] as const)(
  'fences earlier datasource replacement while a later %s description is pending',
  async (operation) => {
    const { session, datasource, canonical, stage } = setupContext();
    canonical.setState({ queries: original.map((query) => ({ ...query, datasource: { uid: query.refId } })) });
    let currentA = datasource;
    const later = Object.assign(getMockDataSource(), { queryCoauthoring: datasource.queryCoauthoring });
    mockGetDataSource.mockImplementation(async (ref) => (ref.uid === 'A' ? currentA : later));
    let release!: (value: Awaited<ReturnType<typeof language.describe>>) => void;
    datasource.queryCoauthoring = () => ({
      ...language,
      getQuerySupport: () => ({ editable: true }),
      describe: (query) =>
        query.refId === 'B'
          ? new Promise((resolve) => {
              release = resolve;
            })
          : language.describe(query, { signal: new AbortController().signal }),
    });
    later.queryCoauthoring = datasource.queryCoauthoring;
    const pending =
      operation === 'context'
        ? session.getContext({ baseRevision: session.getState().revision })
        : session.stageProposal(
            [
              {
                changes: [
                  { refId: 'A', text: 'sum(up)' },
                  { refId: 'B', text: 'sum(requests)' },
                ],
              },
            ],
            { baseRevision: session.getState().revision, baseContextGeneration: session.getState().contextGeneration }
          );
    await waitFor(() => expect(typeof release).toBe('function'));
    const replacement = Object.assign(getMockDataSource(), {
      queryCoauthoring: () => ({ ...language, getQuerySupport: () => ({ editable: true }) }),
    });
    currentA = replacement;
    release({ text: 'rate(requests[5m])', language: { id: 'promql', displayName: 'PromQL' } });
    expect(await pending).toMatchObject(operation === 'context' ? { status: 'stale' } : [{ status: 'stale' }]);
    expect(session.getState().proposal).toBeNull();
    later.queryCoauthoring = replacement.queryCoauthoring;
    expect((await stage())[0].status).toBe('staged');
  }
);

it('reports superseded stage work as aborted instead of spending a stale repair', async () => {
  const { session, datasource, stage } = setupContext();
  const describe = jest.fn(language.describe).mockImplementationOnce(() => new Promise(() => {}));
  datasource.queryCoauthoring = () => ({ ...language, getQuerySupport: () => ({ editable: true }), describe });
  const first = stage();
  await waitFor(() => expect(describe).toHaveBeenCalledTimes(1));
  expect((await stage())[0].status).toBe('staged');
  expect(await first).toEqual([{ status: 'aborted' }]);
  expect(session.getState().proposal?.[0]).toMatchObject({ diffs: [{ refId: 'B', proposed: 'sum(up)' }] });
});

it.each([
  ['different refId', (query: TextQuery) => ({ status: 'ready', query: { ...query, refId: 'Other' }, changes: [] })],
  [
    'different datasource',
    (query: TextQuery) => ({ status: 'ready', query: { ...query, datasource: { uid: 'other' } }, changes: [] }),
  ],
  [
    'malformed text changes',
    (query: TextQuery) => ({ status: 'ready', query: { ...query, expr: 'sum(up)' }, changes: [{}] }),
  ],
  ['unknown rejection', () => ({ status: 'rejected', reason: 'offline' })],
])('treats adapter-produced %s as preparation failure on the requested query', async (_name, prepare) => {
  const { datasource, stage } = setupContext();
  datasource.queryCoauthoring = () =>
    ({ ...language, getQuerySupport: () => ({ editable: true }), prepare }) as QueryCoauthoringLanguage<TextQuery>;
  expect(await stage('B')).toEqual([{ status: 'failed', issue: { kind: 'preparation_failed', refId: 'B' } }]);
});

it('keeps the exact later rejected refId after an earlier change prepared successfully', async () => {
  const { session, datasource } = setupContext();
  datasource.queryCoauthoring = () => ({
    ...language,
    getQuerySupport: (query) => ({ editable: query.refId === 'A' }),
  });
  expect(
    await session.stageProposal(
      [
        {
          changes: [
            { refId: 'A', text: 'sum(up)' },
            { refId: 'B', text: 'sum(requests)' },
          ],
        },
      ],
      {
        baseRevision: 0,
        baseContextGeneration: session.getState().contextGeneration,
      }
    )
  ).toEqual([{ status: 'rejected', issue: { kind: 'read_only', refId: 'B' } }]);
  expect(session.getState().proposal).toEqual([]);
});

it.each([
  { status: 'unavailable' as const, reason: 'missing_language' as const, result: 'unsupported' },
  { status: 'failed' as const, reason: 'description_failed' as const, result: 'failed' },
])('retains a $status ranged baseline cause without inventing a text mismatch', async ({ status, reason, result }) => {
  const { panel, datasource } = setup();
  datasource.queryCoauthoring = () => ({ ...language, getQuerySupport: () => ({ editable: true }) });
  const engine = QueryCoauthoringSessionEngine.getOrCreate(panel);
  const baseline = {
    refId: 'A',
    revision: 0,
    contextGeneration: 0,
    ranges: [{ from: 0, to: 2 }],
    ...(status === 'unavailable'
      ? { status, reason: 'missing_language' as const }
      : { status, reason: 'description_failed' as const }),
  };
  const session = engine.enter('A', baseline.ranges, undefined, undefined, baseline);
  expect(await session.getContext({ baseRevision: 0 })).toMatchObject({
    status: 'ready',
    entry: { status, reason, matchesCurrentText: 'unknown' },
  });
  expect(
    await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up)' }] }], {
      baseRevision: 0,
      baseContextGeneration: session.getState().contextGeneration,
    })
  ).toEqual([{ status: result, issue: { kind: reason, refId: 'A' } }]);
});

it('fences panel-scoped variable changes and notifies context subscribers without editing queries', async () => {
  const { panel, session, canonical } = setupContext();
  const variable = new ConstantVariable({ name: 'source', value: 'prom' });
  panel.setState({ $variables: new SceneVariableSet({ variables: [variable] }) });
  canonical.setState({ datasource: { uid: '$source' } });
  const stop = variable.activate();
  const snapshots: number[] = [];
  const unsubscribe = session.subscribe((state) => snapshots.push(state.contextGeneration));
  try {
    const before = session.getState();
    expect(await session.getContext({ baseRevision: before.revision })).toMatchObject({
      status: 'ready',
      contextGeneration: before.contextGeneration,
    });
    expect(mockGetDataSource).toHaveBeenCalledWith(
      { uid: '$source' },
      expect.objectContaining({ __sceneObject: expect.anything() })
    );
    variable.setState({ value: 'other' });
    expect(session.getState()).toMatchObject({
      revision: before.revision,
      contextGeneration: before.contextGeneration + 1,
      queries: original,
    });
    expect(snapshots).toContain(before.contextGeneration + 1);
    expect(
      await session.stageProposal([{ changes: [{ refId: 'B', text: 'sum(up)' }] }], {
        baseRevision: before.revision,
        baseContextGeneration: before.contextGeneration,
      })
    ).toEqual([{ status: 'stale' }]);
  } finally {
    unsubscribe();
    stop();
  }
});

it.each(['before', 'during'] as const)(
  'fences unchanged upstream resolver context changed %s staging a different query',
  async (when) => {
    const { canonical, session, datasource } = setupContext();
    canonical.setState({ queries: original.map((query) => ({ ...query, datasource: { uid: query.refId } })) });
    let currentA = datasource;
    let release!: (value: Awaited<ReturnType<typeof language.describe>>) => void;
    let pending = false;
    const prepare = jest.fn(language.prepare);
    const later = Object.assign(getMockDataSource(), {
      queryCoauthoring: () => ({
        ...language,
        getQuerySupport: () => ({ editable: true }),
        prepare,
        describe: (query: TextQuery, options: { signal: AbortSignal }) =>
          pending
            ? new Promise<Awaited<ReturnType<typeof language.describe>>>((resolve) => {
                release = resolve;
              })
            : language.describe(query, options),
      }),
    });
    mockGetDataSource.mockImplementation(async (ref) => (ref.uid === 'A' ? currentA : later));
    const context = await session.getContext({ baseRevision: 1 });
    expect(context.status).toBe('ready');
    if (context.status !== 'ready') {
      throw new Error('Expected ready');
    }
    const replacement = Object.assign(getMockDataSource(), { queryCoauthoring: datasource.queryCoauthoring });
    if (when === 'before') {
      currentA = replacement;
    } else {
      pending = true;
    }
    const staging = session.stageProposal([{ changes: [{ refId: 'B', text: 'sum(requests)' }] }], {
      baseRevision: 1,
      baseContextGeneration: context.contextGeneration,
    });
    if (when === 'during') {
      await waitFor(() => expect(typeof release).toBe('function'));
      currentA = replacement;
      pending = false;
      release({ text: original[1].expr, language: { id: 'promql', displayName: 'PromQL' } });
    }
    expect(await staging).toEqual([{ status: 'stale' }]);
    expect(session.getState()).toMatchObject({ revision: 1, queries: canonical.state.queries });
    expect(await session.getContext({ baseRevision: 1 })).toMatchObject({ status: 'ready' });
  }
);

it('advances resolver generation across supported, missing and restored language outcomes', async () => {
  const { session, datasource } = setupContext();
  const supported = datasource.queryCoauthoring();
  let adapter: unknown = supported;
  datasource.queryCoauthoring = () => adapter as QueryCoauthoringLanguage<TextQuery>;
  const before = await session.getContext({ baseRevision: 0 });
  expect(before.status).toBe('ready');
  const generation = session.getState().contextGeneration;
  adapter = undefined;
  expect(await session.getContext({ baseRevision: 0 })).toMatchObject({
    status: 'stale',
    currentContextGeneration: generation + 1,
  });
  expect(await session.getContext({ baseRevision: 0 })).toMatchObject({
    status: 'ready',
    queries: expect.arrayContaining([
      expect.objectContaining({ refId: 'A', editability: { kind: 'unsupported', reason: 'missing_language' } }),
    ]),
  });
  adapter = supported;
  expect(await session.getContext({ baseRevision: 0 })).toMatchObject({
    status: 'stale',
    currentContextGeneration: generation + 2,
  });
  expect(await session.getContext({ baseRevision: 0 })).toMatchObject({
    status: 'ready',
    queries: expect.arrayContaining([expect.objectContaining({ refId: 'A', editability: { kind: 'editable' } })]),
  });
});

it.each([
  { phase: 'datasource_resolution', issue: 'datasource_resolution_failed' },
  { phase: 'language_resolution', issue: 'language_resolution_failed' },
  { phase: 'support_check', issue: 'support_check_failed' },
  { phase: 'description', issue: 'description_failed' },
  { phase: 'preparation', issue: 'preparation_failed' },
])('reports thrown $phase failures while retaining the typed staging result', async ({ phase, issue }) => {
  const { session, datasource } = setup();
  const failure = new Error('Operational failure');
  const fail = () => {
    throw failure;
  };
  if (phase === 'datasource_resolution') {
    mockGetDataSource.mockRejectedValue(failure);
  } else if (phase === 'language_resolution') {
    datasource.queryCoauthoring = fail;
  } else {
    datasource.queryCoauthoring = () => ({
      ...language,
      ...{
        support_check: { getQuerySupport: fail },
        description: { describe: fail },
        preparation: { prepare: fail },
      }[phase],
    });
  }
  expect(
    await session.stageProposal([{ changes: [{ refId: 'A', text: 'sum(up)' }] }], {
      baseRevision: 0,
      baseContextGeneration: session.getState().contextGeneration,
    })
  ).toEqual([{ status: 'failed', issue: { kind: issue, refId: 'A' } }]);
  expect(logError).toHaveBeenCalledWith(failure, { component: 'query-coauthoring', phase });
  expect(session.getState().proposal).toEqual([]);
});
