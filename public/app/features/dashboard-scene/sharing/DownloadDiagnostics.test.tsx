import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { getDefaultTimeRange, LoadingState, toDataFrame, type PanelData, type ScopedVars } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { logError, setPluginImportUtils } from '@grafana/runtime';
import { getDataSourceInstance } from '@grafana/runtime/unstable';
import { SceneGridLayout, SceneQueryRunner, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { downloadDiagnosticsForQueries } from 'app/features/query/diagnostics/downloadDiagnostics';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { DownloadDiagnostics } from './DownloadDiagnostics';

jest.mock('app/features/query/diagnostics/downloadDiagnostics', () => ({
  downloadDiagnosticsForQueries: jest.fn(),
}));

// Interpolation runs through the real interpolateDiagnosticsQueries helper; only the datasource
// lookup is mocked. interpolateVariablesInQueries defaults to an identity so the plain scenarios
// forward their queries unchanged, and individual tests override it to assert interpolation.
const interpolateVariablesInQueries = jest.fn(
  (queries: DataQuery[], _scopedVars?: ScopedVars, _filters?: unknown): DataQuery[] => queries
);
jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstance: jest.fn(() => Promise.resolve({ interpolateVariablesInQueries })),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  logError: jest.fn(),
}));

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

describe('DownloadDiagnostics', () => {
  beforeEach(() => {
    jest.mocked(downloadDiagnosticsForQueries).mockClear();
    // The drawer reads the result to decide whether to warn about a trimmed bundle, so the mock has to
    // resolve to one; a bare jest.fn() resolves undefined and the drawer would report a failed download.
    jest.mocked(downloadDiagnosticsForQueries).mockResolvedValue({ droppedArtifacts: 0 });
    jest.mocked(logError).mockClear();
    interpolateVariablesInQueries.mockClear();
    interpolateVariablesInQueries.mockImplementation((queries: DataQuery[]) => queries);
  });

  it('renders the sensitive-data warning and download action', () => {
    const { tab } = setupScenario();

    render(<tab.Component model={tab} />);

    expect(screen.getByText('May contain sensitive data')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download diagnostics' })).toBeInTheDocument();
  });

  it('warns that the bundle is incomplete when the size limit dropped artifacts', async () => {
    jest.mocked(downloadDiagnosticsForQueries).mockResolvedValue({ droppedArtifacts: 2 });
    const { tab } = setupScenario();

    render(<tab.Component model={tab} />);
    await userEvent.click(screen.getByRole('button', { name: 'Download diagnostics' }));

    // A warning, not an error: the bundle downloaded and what it holds is still worth reading.
    expect(await screen.findByText('The bundle is incomplete')).toBeInTheDocument();
    expect(screen.getByText(/2 artifacts were left out/)).toBeInTheDocument();
    expect(screen.queryByText('Failed to generate diagnostics')).not.toBeInTheDocument();
  });

  it('says nothing about the size limit for a complete bundle', async () => {
    const { tab } = setupScenario();

    render(<tab.Component model={tab} />);
    await userEvent.click(screen.getByRole('button', { name: 'Download diagnostics' }));

    expect(downloadDiagnosticsForQueries).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('The bundle is incomplete')).not.toBeInTheDocument();
  });

  it('passes the panel visible queries and time range when downloading', async () => {
    const { tab } = setupScenario();

    render(<tab.Component model={tab} />);
    await userEvent.click(screen.getByRole('button', { name: 'Download diagnostics' }));

    expect(downloadDiagnosticsForQueries).toHaveBeenCalledTimes(1);
    const [{ queries, from, to }] = jest.mocked(downloadDiagnosticsForQueries).mock.calls[0];
    // The component forwards the panel's queries verbatim; hidden-query filtering happens
    // downstream in downloadDiagnosticsForQueries (mocked here).
    expect(queries).toEqual([{ refId: 'A' }, { refId: 'B', hide: true }]);
    expect(typeof from).toBe('string');
    expect(typeof to).toBe('string');
  });

  it('forwards the dashboard save model and this panel’s JSON (resolved by id)', async () => {
    const { tab } = setupScenario();

    render(<tab.Component model={tab} />);
    await userEvent.click(screen.getByRole('button', { name: 'Download diagnostics' }));

    const [{ panel: panelModel, dashboard: dashboardModel }] = jest.mocked(downloadDiagnosticsForQueries).mock.calls[0];
    // The whole dashboard save model is sent (bundled as dashboard.json), and this panel's JSON is
    // resolved from it by id (VizPanel key "panel-1" -> id 1) and sent as panel.json.
    expect(dashboardModel).toEqual(expect.objectContaining({ uid: 'dash-1' }));
    expect(panelModel).toEqual(expect.objectContaining({ id: 1, type: 'table' }));
  });

  it('resolves a v2 repeat clone using the serializer element mapping', async () => {
    const panelElement = { kind: 'Panel', spec: { id: 7, title: 'V2 panel' } };
    const dashboardModel = {
      title: 'V2 dashboard',
      elements: { 'custom-panel-key': panelElement },
      layout: { kind: 'GridLayout', spec: { items: [] } },
    };
    const { tab } = setupScenario(undefined, undefined, 'panel-7-clone-1', dashboardModel, 'v2');

    render(<tab.Component model={tab} />);
    await userEvent.click(screen.getByRole('button', { name: 'Download diagnostics' }));

    const [{ panel: panelModel, dashboard: forwardedDashboardModel }] =
      jest.mocked(downloadDiagnosticsForQueries).mock.calls[0];
    expect(forwardedDashboardModel).toBe(dashboardModel);
    expect(panelModel).toBe(panelElement);
  });

  it('still downloads (without panel/dashboard JSON) when getSaveModel throws', async () => {
    // getSaveModel() can throw (e.g. a v2 CUE validation failure). The panel/dashboard JSON is optional
    // context, so its failure must not abort a download whose queries and time range are already valid.
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const saveModelError = new Error('v2 validation failed');
    const { tab, dashboard } = setupScenario();
    jest.spyOn(dashboard, 'getSaveModel').mockImplementation(() => {
      throw saveModelError;
    });

    render(<tab.Component model={tab} />);
    await userEvent.click(screen.getByRole('button', { name: 'Download diagnostics' }));

    expect(downloadDiagnosticsForQueries).toHaveBeenCalledTimes(1);
    const [{ panel: panelModel, dashboard: dashboardModel }] = jest.mocked(downloadDiagnosticsForQueries).mock.calls[0];
    expect(panelModel).toBeUndefined();
    expect(dashboardModel).toBeUndefined();
    expect(screen.queryByText('Failed to generate diagnostics')).not.toBeInTheDocument();
    // The bundle is still produced, so the omission has to be reported somewhere or a bundle missing
    // panel.json looks identical to one that never had it.
    expect(logError).toHaveBeenCalledWith(saveModelError, { panelKey: 'panel-1', dashboardUid: 'dash-1' });
    expect(consoleWarn).toHaveBeenCalled();
    consoleWarn.mockRestore();
  });

  it('forwards the frames the frontend was holding for the panel', async () => {
    const runner = new SceneQueryRunner({ queries: [{ refId: 'A' }] });
    runner.setState({ data: dataWith(toDataFrame({ refId: 'A', name: 'host-a', fields: [] })) });
    const { tab } = setupScenario(undefined, runner);

    render(<tab.Component model={tab} />);
    await userEvent.click(screen.getByRole('button', { name: 'Download diagnostics' }));

    const [{ panelData }] = jest.mocked(downloadDiagnosticsForQueries).mock.calls[0];
    // Bundled as paneldata.json, which is what querydata.json (the backend's frames) gets diffed against.
    expect(panelData).toMatchObject({
      version: 1,
      panelKey: 'panel-1',
      frames: [expect.objectContaining({ schema: expect.objectContaining({ name: 'host-a' }) })],
    });
  });

  it('records a capture failure in the payload instead of sinking the whole download', async () => {
    // dataFrameToJSON copies field config by reference, so an unserializable frame gets through it and
    // only blows up in the request's JSON.stringify. That has to be contained here, or one bad frame
    // costs the user traffic.har and querydata.json too.
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const runner = new SceneQueryRunner({ queries: [{ refId: 'A' }] });
    runner.setState({
      data: dataWith(
        toDataFrame({ refId: 'A', fields: [{ name: 'value', values: [1], config: { custom: circular } }] })
      ),
    });
    const { tab } = setupScenario(undefined, runner);

    render(<tab.Component model={tab} />);
    await userEvent.click(screen.getByRole('button', { name: 'Download diagnostics' }));

    expect(downloadDiagnosticsForQueries).toHaveBeenCalledTimes(1);
    const [{ panelData }] = jest.mocked(downloadDiagnosticsForQueries).mock.calls[0];
    // The failure is recorded rather than dropped: an absent artifact would be indistinguishable from a
    // panel that had no frames to give. No frames key, which would read as exactly that.
    expect(panelData).toEqual({
      version: 1,
      panelKey: 'panel-1',
      pluginId: 'table',
      captureError: expect.stringContaining('circular'),
      // The stack of the throw, which is the part that says which line of the capture broke. Matched
      // loosely: the frames come from whichever engine ran the serialization guard.
      captureStack: expect.any(String),
    });
    expect(screen.queryByText('Failed to generate diagnostics')).not.toBeInTheDocument();
    expect(logError).toHaveBeenCalledWith(expect.any(Error), { panelKey: 'panel-1' });
    expect(consoleWarn).toHaveBeenCalled();
    consoleWarn.mockRestore();
  });

  it('fills the runner-level datasource onto queries that lack one', async () => {
    const runner = new SceneQueryRunner({
      datasource: { uid: 'runner-ds', type: 'prometheus' },
      queries: [{ refId: 'A' }, { refId: 'B', datasource: { uid: 'own-ds', type: 'loki' } }],
    });
    const { tab } = setupScenario(undefined, runner);

    render(<tab.Component model={tab} />);
    await userEvent.click(screen.getByRole('button', { name: 'Download diagnostics' }));

    const [{ queries }] = jest.mocked(downloadDiagnosticsForQueries).mock.calls[0];
    expect(queries).toEqual([
      // A had no datasource -> filled from the runner; B keeps its own.
      { refId: 'A', datasource: { uid: 'runner-ds', type: 'prometheus' } },
      { refId: 'B', datasource: { uid: 'own-ds', type: 'loki' } },
    ]);
  });

  it('interpolates template variables before posting, scoped to the panel', async () => {
    interpolateVariablesInQueries.mockImplementation((queries: DataQuery[]) =>
      queries.map((q) => ({ ...q, expr: (q as { expr?: string }).expr?.replace('$job', 'grafana') }))
    );
    const runner = new SceneQueryRunner({
      datasource: { uid: 'prom', type: 'prometheus' },
      queries: [{ refId: 'A', expr: 'up{job="$job"}' }],
    });
    const { tab } = setupScenario(undefined, runner);

    render(<tab.Component model={tab} />);
    await userEvent.click(screen.getByRole('button', { name: 'Download diagnostics' }));

    const [{ queries }] = jest.mocked(downloadDiagnosticsForQueries).mock.calls[0];
    // The resolved query, not the literal $job, is what gets captured (WMD1 / #1530).
    expect(queries).toEqual([
      { refId: 'A', datasource: { uid: 'prom', type: 'prometheus' }, expr: 'up{job="grafana"}' },
    ]);
    // scopedVars carries the panel so scene variables (incl. repeat-local values) resolve.
    expect(interpolateVariablesInQueries.mock.calls[0][1]?.__sceneObject).toBeDefined();
  });

  it('shows the request status in the alert when the download fails', async () => {
    // getBackendSrv fetch (responseType blob) rejects with a FetchError whose detail is in
    // status/statusText, not message — the alert must still show something useful.
    jest
      .mocked(downloadDiagnosticsForQueries)
      .mockRejectedValueOnce({ status: 404, statusText: 'Not Found', data: new Blob() });
    const { tab } = setupScenario();

    render(<tab.Component model={tab} />);
    await userEvent.click(screen.getByRole('button', { name: 'Download diagnostics' }));

    expect(await screen.findByText('404 Not Found')).toBeInTheDocument();
  });

  it('shows a message and does not POST when the panel has no active queries', async () => {
    const runner = new SceneQueryRunner({ queries: [{ refId: 'A', hide: true }] });
    const { tab } = setupScenario(undefined, runner);

    render(<tab.Component model={tab} />);
    await userEvent.click(screen.getByRole('button', { name: 'Download diagnostics' }));

    expect(await screen.findByText('This panel has no active queries to capture.')).toBeInTheDocument();
    expect(downloadDiagnosticsForQueries).not.toHaveBeenCalled();
  });

  it('calls onDismiss when cancelled', async () => {
    const onDismiss = jest.fn();
    const { tab } = setupScenario(onDismiss);

    render(<tab.Component model={tab} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not start the download when cancelled while queries are still being interpolated', async () => {
    // Park the flow inside interpolation: interpolateDiagnosticsQueries awaits the datasource lookup,
    // so holding this promise keeps execution before the download starts.
    let resolveLookup!: () => void;
    const pendingLookup = new Promise((resolve) => {
      resolveLookup = () => resolve({ interpolateVariablesInQueries });
    });
    jest.mocked(getDataSourceInstance).mockReturnValueOnce(pendingLookup as ReturnType<typeof getDataSourceInstance>);
    const onDismiss = jest.fn();
    const runner = new SceneQueryRunner({
      datasource: { uid: 'prom', type: 'prometheus' },
      queries: [{ refId: 'A', expr: 'up' }],
    });
    const { tab } = setupScenario(onDismiss, runner);

    render(<tab.Component model={tab} />);
    await userEvent.click(screen.getByRole('button', { name: 'Download diagnostics' }));
    // Cancel while interpolation is still in flight; the abort controller now exists (created before
    // interpolation), so this must abort it rather than no-op against a null ref.
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    // Let interpolation finish: the aborted controller must stop the flow before the download starts.
    resolveLookup();
    await screen.findByRole('button', { name: 'Download diagnostics' });

    expect(downloadDiagnosticsForQueries).not.toHaveBeenCalled();
  });
});

// Resolved query-runner data, as the runner would hold it after a completed query.
function dataWith(...series: PanelData['series']): PanelData {
  return { state: LoadingState.Done, series, timeRange: getDefaultTimeRange() };
}

function setupScenario(
  onDismiss?: () => void,
  runner?: SceneQueryRunner,
  panelKey = 'panel-1',
  dashboardSaveModel: unknown = {
    uid: 'dash-1',
    panels: [{ id: 1, type: 'table', title: 'Panel' }],
  },
  serializerVersion: 'v1' | 'v2' = 'v1'
) {
  const vizPanel = new VizPanel({
    key: panelKey,
    pluginId: 'table',
    title: 'Panel',
    $data: runner ?? new SceneQueryRunner({ queries: [{ refId: 'A' }, { refId: 'B', hide: true }] }),
  });

  const gridItem = new DashboardGridItem({ key: 'grid-item-1', body: vizPanel });

  const dashboard = new DashboardScene(
    {
      title: 'Dash',
      uid: 'dash-1',
      meta: { canEdit: true },
      $timeRange: new SceneTimeRange({}),
      body: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [gridItem] }) }),
    },
    serializerVersion
  );

  if (serializerVersion === 'v2') {
    dashboard.serializer.initializeElementMapping(dashboardSaveModel as DashboardV2Spec);
  }

  // Stub the save model so tests exercise this view's panel lookup + payload wiring without depending
  // on serializer internals. The default is v1; individual tests can supply a v2 model.
  jest.spyOn(dashboard, 'getSaveModel').mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dashboardSaveModel as any
  );

  const tab = new DownloadDiagnostics({
    panelRef: vizPanel.getRef(),
    dashboardRef: dashboard.getRef(),
    onDismiss,
  });
  dashboard.setState({ overlay: tab });

  // Constructing the scene wires up parent pointers, which is all sceneGraph.getTimeRange and the
  // query-runner lookup need here. We deliberately skip activation so the SceneQueryRunner does not
  // try to execute (and fail) its queries against a real datasource.
  return { tab, dashboard };
}
