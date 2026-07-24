import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { type ScopedVars } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { getDataSourceInstance } from '@grafana/runtime/unstable';
import { SceneGridLayout, SceneQueryRunner, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
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

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

describe('DownloadDiagnostics', () => {
  beforeEach(() => {
    jest.mocked(downloadDiagnosticsForQueries).mockClear();
    interpolateVariablesInQueries.mockClear();
    interpolateVariablesInQueries.mockImplementation((queries: DataQuery[]) => queries);
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

    const [queries] = jest.mocked(downloadDiagnosticsForQueries).mock.calls[0];
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

function setupScenario(onDismiss?: () => void, runner?: SceneQueryRunner) {
  const vizPanel = new VizPanel({
    key: 'panel-1',
    pluginId: 'table',
    title: 'Panel',
    $data: runner ?? new SceneQueryRunner({ queries: [{ refId: 'A' }, { refId: 'B', hide: true }] }),
  });

  const gridItem = new DashboardGridItem({ key: 'grid-item-1', body: vizPanel });

  const tab = new DownloadDiagnostics({
    panelRef: vizPanel.getRef(),
    onDismiss,
  });

  const dashboard = new DashboardScene({
    title: 'Dash',
    uid: 'dash-1',
    meta: { canEdit: true },
    $timeRange: new SceneTimeRange({}),
    body: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [gridItem] }) }),
    overlay: tab,
  });

  // Constructing the scene wires up parent pointers, which is all sceneGraph.getTimeRange and the
  // query-runner lookup need here. We deliberately skip activation so the SceneQueryRunner does not
  // try to execute (and fail) its queries against a real datasource.
  return { tab, dashboard };
}
