import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { of } from 'rxjs';

import { type DataSourceApi, type QueryEditorProps, LoadingState, toDataFrame } from '@grafana/data';
import { faro } from '@grafana/faro-web-sdk';
import { config, reportInteraction, setRunRequest } from '@grafana/runtime';
import { FlagKeys, setExpressionDataSourceInstance } from '@grafana/runtime/internal';
import { SceneQueryRunner, SceneTimeRange, VizPanel, SceneGridLayout } from '@grafana/scenes';
import { getTestFeatureFlagClient, setTestFlags } from '@grafana/test-utils/unstable';
import {
  notifyExtensionSidebarClosed,
  setExtensionSidebarPresentation,
  collapseFloatingExtensionSidebar,
  resetExtensionSidebarPresentationForTests,
} from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarLayout';
import { dataSource } from 'app/features/expressions/ExpressionDatasource';
import { ExpressionQueryType } from 'app/features/expressions/types';
import { getRestrictedGrafanaApisAtLoad } from 'app/features/plugins/components/restrictedGrafanaApis/restrictedGrafanaApis';
import { getMockDataSource } from 'app/features/query/state/mocks/mockDataSource';

import { DashboardScene } from '../../../../scene/DashboardScene';
import { DashboardGridItem } from '../../../../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../../../../scene/layout-default/DefaultGridLayoutManager';
import { PanelEditor } from '../../../PanelEditor';
import { PanelDataPaneNext } from '../../PanelDataPaneNext';
import { useQueryEditorUIContext } from '../QueryEditorContext';
import { QueryEditorContextWrapper } from '../QueryEditorContextWrapper';
import { QueryEditorRenderer, QueryEditorPanel } from '../QueryEditorRenderer';
import { QueryCard } from '../Sidebar/Cards/QueryCard';
import { ds1SettingsMock } from '../testUtils';

import { QueryCoauthoringCard } from './QueryCoauthoringCard';
import {
  isQueryCoauthoringAPI,
  isQueryCoauthoringSession,
  type QueryCoauthoringEditorHandle,
  type QueryCoauthoringSession,
  type QueryEditorPropsWithCoauthoring,
  type RestrictedGrafanaApisWithQueryCoauthoring,
} from './queryCoauthoringContracts';
import { useMountedCoauthoringPanel } from './useCoauthoringSurface';

jest.mock('@grafana/faro-web-sdk', () => ({
  ...jest.requireActual('@grafana/faro-web-sdk'),
  faro: { api: { startUserAction: jest.fn() } },
}));
jest.mock('app/features/alerting/unified/hooks/usePanelCombinedRules', () => ({
  usePanelCombinedRules: () => ({ rules: [], loading: false }),
}));
const mockGetDataSource = jest.fn();
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
  getDataSourceInstanceSettings: async () => ds1SettingsMock,
  getDataSourceInstance: (...args: unknown[]) => mockGetDataSource(...args),
  getDataSourceSrv: () => ({ get: mockGetDataSource, getInstanceSettings: () => ds1SettingsMock }),
}));

const showChanges = jest.fn();
let notifySelection: () => void;
let selection = false;
let handleVersion = 1;
let marksSupported = true;
let cleanupEditor: jest.Mock;
function Editor(props: QueryEditorPropsWithCoauthoring<QueryEditorProps<DataSourceApi>>) {
  const anchor = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!props.queryCoauthoring) {
      return;
    }
    const handle = {
      version: handleVersion,
      getSelection: () => (selection ? { ranges: [{ from: 0, to: 2 }], anchor: anchor.current! } : null),
      subscribe: (listener: () => void) => {
        notifySelection = listener;
        return cleanupEditor;
      },
      ...(marksSupported ? { showChanges } : {}),
    };
    // A separately shipped editor can send a handle from a newer, unsupported version.
    return props.queryCoauthoring.register(handle as QueryCoauthoringEditorHandle);
  }, [props.queryCoauthoring]);
  return (
    <>
      <input
        ref={anchor}
        aria-label="Query text"
        value={'expression' in props.query ? String(props.query.expression) : ''}
        onChange={(event) => {
          const updated = { ...props.query, expression: event.target.value };
          props.onChange(updated);
        }}
      />
      <button onClick={() => props.queryCoauthoring?.invoke()}>Shortcut</button>
      <output aria-label="Host version">{props.queryCoauthoring?.version ?? 'absent'}</output>
      <output aria-label="V1 registration">
        {'unstable_queryEditorCoauthoringV1' in props && props.unstable_queryEditorCoauthoringV1 ? 'v1' : 'absent'}
      </output>
    </>
  );
}
const original = [
  { refId: 'A', type: ExpressionQueryType.math, expression: '1', datasource: { uid: '__expr__', type: '__expr__' } },
  {
    refId: 'B',
    type: ExpressionQueryType.math,
    expression: '$A + 1',
    datasource: { uid: '__expr__', type: '__expr__' },
  },
];
const target = { panelId: 1, refId: 'B' };
let unlisten: Array<() => void>;
beforeEach(() => {
  unlisten = [];
  showChanges.mockClear();
  jest.mocked(faro.api.startUserAction).mockClear();
  cleanupEditor = jest.fn();
  selection = false;
  handleVersion = 1;
  marksSupported = true;
  jest.mocked(reportInteraction).mockClear();
  Object.defineProperty(navigator, 'userActivation', { configurable: true, value: { isActive: true } });
  setTestFlags({ [FlagKeys.QueryeditorCoauthoringUi]: true, [FlagKeys.GrafanaVisualDesignRefresh]: true });
  jest.replaceProperty(config.bootData, 'settings', {
    ...config.bootData.settings,
    pluginRestrictedAPIsAllowList: { queryCoauthoring: ['grafana-assistant-app'] },
  });
});
afterEach(() => {
  act(() => unlisten.forEach((stop) => stop()));
  act(() => setTestFlags({}));
  jest.restoreAllMocks();
});
function api() {
  const apis: RestrictedGrafanaApisWithQueryCoauthoring = getRestrictedGrafanaApisAtLoad('grafana-assistant-app');
  if (!isQueryCoauthoringAPI(apis.queryCoauthoring)) {
    throw new Error('Missing v1 API');
  }
  return apis.queryCoauthoring;
}
function setup(listener = true) {
  const datasource = Object.assign(getMockDataSource(), {
    queryCoauthoring: () => dataSource.queryCoauthoring(),
    components: { QueryEditor: Editor },
  });
  mockGetDataSource.mockResolvedValue(datasource);
  setExpressionDataSourceInstance(datasource);
  const timeRange = new SceneTimeRange();
  const data = {
    state: LoadingState.Done,
    series: ['A', 'B'].map((refId) => toDataFrame({ refId, fields: [{ name: 'value', values: [1] }] })),
    timeRange: timeRange.state.value,
  };
  const canonical = new SceneQueryRunner({
    queries: original,
    datasource: { uid: '__expr__' },
    data,
    runQueriesMode: 'manual',
  });
  const panel = new VizPanel({ key: 'panel-1', $data: canonical, $timeRange: timeRange });
  const pane = new PanelDataPaneNext({ panelRef: panel.getRef() });
  const select = jest.fn();
  const entry = jest.fn();
  if (listener) {
    unlisten.push(api().onEnterRequested(entry));
  }
  setRunRequest((_ds, request) => of({ ...data, request }));
  function Mounted() {
    canonical.useState();
    useMountedCoauthoringPanel(pane, panel, canonical.state.queries, select);
    return (
      <>
        <QueryEditorPanel
          panel={panel}
          query={canonical.state.queries[1] ?? canonical.state.queries[0]}
          queryDsData={{ datasource, dsSettings: { ...ds1SettingsMock, type: 'prometheus' } }}
          queryDsLoading={false}
          queries={canonical.state.queries}
          data={canonical.state.data}
          updateQuery={pane.updateSelectedQuery}
          addQuery={pane.addQuery}
          runQueries={pane.runQueries}
          startQueryPreview={pane.startQueryPreview}
        />
        <QueryCoauthoringCard refId="A" />
        <QueryCoauthoringCard refId="B" />
      </>
    );
  }
  const view = render(
    <OpenFeatureProvider client={getTestFeatureFlagClient()}>
      <Mounted />
    </OpenFeatureProvider>
  );
  return { ...view, canonical, pane, select, entry, datasource };
}
async function enter() {
  await waitFor(() => expect(api().canEnter(target)).toEqual({ ok: true }));
  let session: unknown;
  await act(async () => {
    session = await api().enter(target);
  });
  if (!isQueryCoauthoringSession(session)) {
    throw new Error('Invalid session handle');
  }
  return session;
}
async function propose(session: QueryCoauthoringSession, refId = 'B') {
  let id = '';
  await act(async () => {
    const [result] = await session.stageProposal(
      [{ changes: [{ refId, text: '2' }] }, { changes: [{ refId, text: '3' }] }],
      { baseRevision: session.getState().revision }
    );
    if (result.status !== 'staged') {
      throw new Error(result.status);
    }
    id = result.id;
    session.preview(id);
  });
  return id;
}

it('exposes only the allowed API under the flag, preserves v1 without a listener and switches back on unsubscribe', async () => {
  setup(false);
  expect(screen.getByLabelText('V1 registration')).toHaveTextContent('v1');
  expect(screen.getByLabelText('Host version')).toHaveTextContent('absent');
  expect(getRestrictedGrafanaApisAtLoad('other-app')).not.toHaveProperty('queryCoauthoring');
  const callback = jest.fn();
  let stop = () => {};
  act(() => {
    stop = api().onEnterRequested(callback);
  });
  expect(screen.getByLabelText('Host version')).toHaveTextContent('1');
  expect(screen.getByLabelText('V1 registration')).toHaveTextContent('absent');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Explain or modify query B' })).toBeInTheDocument());
  act(() => stop());
  expect(screen.getByLabelText('V1 registration')).toHaveTextContent('v1');
  expect(cleanupEditor).toHaveBeenCalledTimes(1);
  act(() => setTestFlags({ [FlagKeys.QueryeditorCoauthoringUi]: false }));
  expect(getRestrictedGrafanaApisAtLoad('grafana-assistant-app')).not.toHaveProperty('queryCoauthoring');
});

it('forwards highlight ranges and shortcuts without selection, and emits Resume without ending a session', async () => {
  const { entry } = setup();
  await waitFor(() => expect(api().canEnter(target)).toEqual({ ok: true }));
  act(() => {
    selection = true;
    notifySelection();
  });
  fireEvent.click(screen.getByRole('button', { name: 'Explain or modify' }));
  expect(entry).toHaveBeenLastCalledWith(
    expect.objectContaining({
      target,
      ranges: [{ from: 0, to: 2 }],
      intent: 'explain_or_modify',
      health: { A: 'ok', B: 'ok' },
    })
  );
  const session = await enter();
  const resume = jest.fn();
  unlisten.push(api().onResumeRequested(resume));
  fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
  expect(resume).toHaveBeenCalledWith({ sessionId: session.getState().sessionId });
  act(() => {
    selection = false;
    notifySelection();
  });
  fireEvent.click(screen.getByRole('button', { name: 'Shortcut' }));
  expect(entry).toHaveBeenLastCalledWith(expect.objectContaining({ ranges: [] }));
  expect(session.signal.aborted).toBe(false);
});

it('renders proposed text, replaces marks, clears them on typing and preserves canonical queries until the edit', async () => {
  const { canonical } = setup();
  const session = await enter();
  await propose(session);
  expect(screen.getByRole('textbox', { name: 'Query text' })).toHaveValue('2');
  expect(screen.getByText('Proposed')).toBeInTheDocument();
  expect(canonical.state.queries).toEqual(original);
  expect(showChanges).toHaveBeenLastCalledWith([expect.objectContaining({ original: '$A + 1', proposed: '2' })]);
  act(() => {
    session.preview(session.getState().proposal![1].id);
  });
  expect(screen.getByRole('textbox', { name: 'Query text' })).toHaveValue('3');
  expect(showChanges).toHaveBeenLastCalledWith([expect.objectContaining({ proposed: '3' })]);
  await act(async () => {
    fireEvent.change(screen.getByRole('textbox', { name: 'Query text' }), { target: { value: '3 + 4' } });
  });
  expect(showChanges).toHaveBeenLastCalledWith(null);
  expect(canonical.state.queries).toEqual([original[0], { ...original[1], expression: '3 + 4' }]);
  expect(session.getState().stale).toBe(true);
});

it('marks an upstream row as proposed without moving selection and allows only explicit select to move it', async () => {
  const { select } = setup();
  const session = await enter();
  await propose(session, 'A');
  expect(screen.getByText('Proposed')).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Query text' })).toHaveValue('$A + 1');
  expect(select).not.toHaveBeenCalled();
  act(() => session.select('A'));
  expect(select).toHaveBeenCalledWith('A');
});

it('shows proposed text and row state without optional marks', async () => {
  marksSupported = false;
  setup();
  const session = await enter();
  await propose(session);
  expect(screen.getByRole('textbox', { name: 'Query text' })).toHaveValue('2');
  expect(screen.getByText('Proposed')).toBeInTheDocument();
  expect(showChanges).not.toHaveBeenCalled();
});

it.each(['exit', 'replaced', 'left_panel_edit', 'flag_off', 'focus_removed'] as const)(
  'closes once with %s and clears marks',
  async (reason) => {
    const { canonical, unmount } = setup();
    const session = await enter();
    await propose(session);
    const closed = jest.fn();
    void session.closed.then(closed);
    await act(async () => {
      if (reason === 'exit') {
        session.exit();
      }
      if (reason === 'replaced') {
        await api().enter(target);
      }
      if (reason === 'left_panel_edit') {
        unmount();
      }
      if (reason === 'flag_off') {
        setTestFlags({ [FlagKeys.QueryeditorCoauthoringUi]: false });
      }
      if (reason === 'focus_removed') {
        canonical.setState({ queries: [original[0]] });
      }
    });
    expect(closed).toHaveBeenCalledTimes(1);
    expect(closed).toHaveBeenCalledWith(reason);
    expect(showChanges).toHaveBeenLastCalledWith(null);
    act(() => session.exit());
    expect(session.signal.aborted).toBe(true);
  }
);

it('enforces activation through the restricted session and emits text-free lifecycle telemetry once', async () => {
  setup();
  await waitFor(() => expect(api().canEnter(target)).toEqual({ ok: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Explain or modify query B' }));
  const session = await enter();
  const id = await propose(session);
  Object.defineProperty(navigator, 'userActivation', { configurable: true, value: { isActive: false } });
  expect(await session.accept(id, { baseRevision: 0 })).toEqual({ status: 'no_user_activation' });
  expect(await session.undo({})).toEqual({ status: 'no_user_activation' });
  Object.defineProperty(navigator, 'userActivation', { configurable: true, value: { isActive: true } });
  await act(async () => {
    expect(await session.accept(id, { baseRevision: 0 })).toEqual({ status: 'applied', revision: 1 });
  });
  await act(async () => {
    expect(await session.undo({})).toEqual({ status: 'applied', revision: 2 });
  });
  await act(async () => session.exit());
  expect(faro.api.startUserAction).toHaveBeenCalledTimes(1);
  expect(faro.api.startUserAction).toHaveBeenCalledWith('query_coauthoring', {
    sessionId: session.getState().sessionId,
  });
  const calls = jest
    .mocked(reportInteraction)
    .mock.calls.filter(([name]) => name.startsWith('grafana_query_coauthoring_'));
  for (const event of [
    'opened_popover',
    'session_opened',
    'proposal_staged',
    'accepted_proposal',
    'undone_proposal',
    'dismissed_popover',
    'option_selected',
  ]) {
    expect(calls.filter(([name]) => name === `grafana_query_coauthoring_${event}`)).toHaveLength(1);
  }
  expect(calls.every(([, props]) => props?.sessionId === session.getState().sessionId)).toBe(true);
  expect(
    calls.every(([, props]) =>
      Object.keys(props ?? {}).every((key) => ['sessionId', 'source', 'kind', 'reason'].includes(key))
    )
  ).toBe(true);
});

it('rejects unknown editor handle versions while leaving the query editor usable', async () => {
  handleVersion = 2;
  setup();
  await waitFor(() => expect(api().canEnter(target)).toEqual({ ok: true }));
  expect(screen.getByRole('textbox', { name: 'Query text' })).toHaveValue('$A + 1');
  expect(showChanges).not.toHaveBeenCalled();
  expect(cleanupEditor).not.toHaveBeenCalled();
});

it.each(['missing', 'newer'])(
  'keeps a query with a %s language contract visible and refuses entry or staging changes',
  async (kind) => {
    const { datasource, canonical } = setup();
    const session = await enter();
    Object.defineProperty(datasource, 'queryCoauthoring', {
      configurable: true,
      value: kind === 'missing' ? undefined : () => ({ version: 2 }),
    });
    await act(async () => canonical.setState({ queries: [...canonical.state.queries] }));
    await waitFor(() => expect(api().canEnter(target)).toEqual({ ok: false, reason: 'unsupported_datasource' }));
    expect(screen.getByRole('textbox', { name: 'Query text' })).toHaveValue('$A + 1');
    await act(async () => {
      expect(await session.stageProposal([{ changes: [{ refId: 'B', text: '2' }] }], { baseRevision: 0 })).toEqual([
        { status: 'unsupported' },
      ]);
    });
    expect(session.getState().queries).toEqual(original);
  }
);

it('shows upstream Error and No data only while v2 is active and gates Debug on broken health', async () => {
  const { canonical } = setup();
  await waitFor(() => expect(api().canEnter(target)).toEqual({ ok: true }));
  act(() =>
    canonical.setState({ data: { ...canonical.state.data!, errors: [{ refId: 'A', message: 'Upstream failed' }] } })
  );
  expect(screen.getAllByText('Error')).toHaveLength(2);
  act(() => {
    selection = true;
    notifySelection();
  });
  expect(screen.getByRole('button', { name: 'Debug query' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Debug query' }));
  act(() =>
    canonical.setState({ data: { ...canonical.state.data!, errors: [], series: [canonical.state.data!.series[1]] } })
  );
  expect(screen.getByText('No data')).toBeInTheDocument();
  act(() => unlisten.forEach((stop) => stop()));
  expect(screen.getByLabelText('V1 registration')).toHaveTextContent('v1');
  expect(screen.queryByText('No data')).not.toBeInTheDocument();
});

function MultiSelectToggle() {
  const { setMultiSelectMode } = useQueryEditorUIContext();
  return <button onClick={() => setMultiSelectMode(true)}>Select multiple</button>;
}

it('connects the real PanelEditNext context wrapper to the restricted session and explicit editor selection', async () => {
  const datasource = Object.assign(getMockDataSource(), {
    queryCoauthoring: () => dataSource.queryCoauthoring(),
    components: { QueryEditor: Editor },
  });
  mockGetDataSource.mockResolvedValue(datasource);
  setExpressionDataSourceInstance(datasource);
  const time = new SceneTimeRange();
  const canonical = new SceneQueryRunner({
    queries: original,
    datasource: { uid: '__expr__' },
    runQueriesMode: 'manual',
  });
  const panel = new VizPanel({ key: 'panel-1', $data: canonical, $timeRange: time });
  const pane = new PanelDataPaneNext({ panelRef: panel.getRef(), datasource, dsSettings: ds1SettingsMock });
  const gridItem = new DashboardGridItem({ body: panel });
  const editor = new PanelEditor({ panelRef: panel.getRef(), dataPane: pane, isNewPanel: false });
  const dashboard = new DashboardScene({
    uid: 'surface-dashboard',
    body: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [gridItem] }) }),
    editPanel: editor,
  });
  const request = jest.fn();
  unlisten.push(api().onEnterRequested(request));
  setRunRequest((_ds, request) => of({ state: LoadingState.Done, series: [], timeRange: time.state.value, request }));
  const view = render(
    <OpenFeatureProvider client={getTestFeatureFlagClient()}>
      <QueryEditorContextWrapper dataPane={pane}>
        <QueryEditorRenderer />
        <MultiSelectToggle />
        <QueryCard query={original[0]} />
        <QueryCard query={original[1]} />
      </QueryEditorContextWrapper>
    </OpenFeatureProvider>
  );
  const panelTarget = { ...target, dashboardUid: dashboard.state.uid };
  await waitFor(() => expect(api().canEnter(panelTarget)).toEqual({ ok: true }));
  let session: unknown;
  await act(async () => {
    session = await api().enter(panelTarget);
  });
  if (!isQueryCoauthoringSession(session)) {
    throw new Error('Invalid session');
  }
  const activeSession = session;
  await act(async () => activeSession.select('B'));
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Query text' })).toHaveValue('$A + 1'));
  await propose(activeSession, 'A');
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Select multiple' }));
  });
  expect(activeSession.signal.aborted).toBe(false);
  expect(screen.getByText('Proposed')).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Query text' })).toHaveValue('$A + 1');
  await act(async () => activeSession.select('A'));
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Query text' })).toHaveValue('2'));
  expect(canonical.state.queries).toEqual(original);
  await act(async () => view.unmount());
  expect(await activeSession.closed).toBe('left_panel_edit');
});

it('retains the open session when the Assistant closes, collapses, moves, or unregisters its entry listener', async () => {
  setup();
  const session = await enter();
  await propose(session);
  act(() => {
    setExtensionSidebarPresentation('floating');
    collapseFloatingExtensionSidebar();
    setExtensionSidebarPresentation('docked');
    notifyExtensionSidebarClosed();
    unlisten.forEach((stop) => stop());
  });
  expect(session.signal.aborted).toBe(false);
  expect(screen.getByLabelText('V1 registration')).toHaveTextContent('v1');
  expect(showChanges).toHaveBeenLastCalledWith(null);
  act(() => {
    unlisten.push(api().onEnterRequested(jest.fn()));
  });
  expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Query text' })).toHaveValue('2');
  act(() => resetExtensionSidebarPresentationForTests());
});

it('replaces an open session on a new query entry before the Assistant enters the new one', async () => {
  setup();
  const session = await enter();
  await propose(session);
  fireEvent.click(screen.getByRole('button', { name: 'Explain or modify query A' }));
  expect(await session.closed).toBe('replaced');
  expect(screen.getByRole('textbox', { name: 'Query text' })).toHaveValue('$A + 1');
});
