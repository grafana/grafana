import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneGridLayout, SceneQueryRunner, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { downloadDiagnosticsForQueries } from 'app/features/query/diagnostics/downloadDiagnostics';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { DownloadDiagnostics } from './DownloadDiagnostics';

jest.mock('app/features/query/diagnostics/downloadDiagnostics', () => ({
  downloadDiagnosticsForQueries: jest.fn(),
}));

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

describe('DownloadDiagnostics', () => {
  beforeEach(() => {
    jest.mocked(downloadDiagnosticsForQueries).mockClear();
  });

  it('renders the sensitive-data warning and download action', () => {
    const { tab } = setupScenario();

    render(<tab.Component model={tab} />);

    expect(screen.getByText('May contain sensitive data')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download diagnostics' })).toBeInTheDocument();
  });

  it('passes the panel visible queries and time range when downloading', async () => {
    const { tab } = setupScenario();

    render(<tab.Component model={tab} />);
    await userEvent.click(screen.getByRole('button', { name: 'Download diagnostics' }));

    expect(downloadDiagnosticsForQueries).toHaveBeenCalledTimes(1);
    const [queries, from, to] = jest.mocked(downloadDiagnosticsForQueries).mock.calls[0];
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

    const [, , , , panelModel, dashboardModel] = jest.mocked(downloadDiagnosticsForQueries).mock.calls[0];
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

    const [, , , , panelModel, forwardedDashboardModel] = jest.mocked(downloadDiagnosticsForQueries).mock.calls[0];
    expect(forwardedDashboardModel).toBe(dashboardModel);
    expect(panelModel).toBe(panelElement);
  });

  it('fills the runner-level datasource onto queries that lack one', async () => {
    const runner = new SceneQueryRunner({
      datasource: { uid: 'runner-ds', type: 'prometheus' },
      queries: [{ refId: 'A' }, { refId: 'B', datasource: { uid: 'own-ds', type: 'loki' } }],
    });
    const { tab } = setupScenario(undefined, runner);

    render(<tab.Component model={tab} />);
    await userEvent.click(screen.getByRole('button', { name: 'Download diagnostics' }));

    const [queries] = jest.mocked(downloadDiagnosticsForQueries).mock.calls[0];
    expect(queries).toEqual([
      // A had no datasource -> filled from the runner; B keeps its own.
      { refId: 'A', datasource: { uid: 'runner-ds', type: 'prometheus' } },
      { refId: 'B', datasource: { uid: 'own-ds', type: 'loki' } },
    ]);
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
});

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
