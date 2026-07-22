import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { type ScopedVars } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneGridLayout, SceneQueryRunner, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import {
  downloadDashboardDiagnostics,
  getDashboardDiagnosticsStatus,
  startDashboardDiagnostics,
} from 'app/features/query/diagnostics/downloadDiagnostics';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { DownloadDashboardDiagnostics } from './DownloadDashboardDiagnostics';

jest.mock('app/features/query/diagnostics/downloadDiagnostics', () => ({
  startDashboardDiagnostics: jest.fn(),
  getDashboardDiagnosticsStatus: jest.fn(),
  downloadDashboardDiagnostics: jest.fn(),
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

describe('DownloadDashboardDiagnostics', () => {
  beforeEach(() => {
    jest.mocked(startDashboardDiagnostics).mockReset();
    jest.mocked(getDashboardDiagnosticsStatus).mockReset();
    jest.mocked(downloadDashboardDiagnostics).mockReset();
    interpolateVariablesInQueries.mockClear();
    interpolateVariablesInQueries.mockImplementation((queries: DataQuery[]) => queries);
  });

  it('renders the sensitive-data warning and download action', () => {
    const { tab } = setupScenario();

    render(<tab.Component model={tab} />);

    expect(screen.getByText('May contain sensitive data')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download diagnostics' })).toBeInTheDocument();
  });

  it('collects every panel with active queries, starts a job, and downloads the completed bundle', async () => {
    jest.mocked(startDashboardDiagnostics).mockResolvedValue('job-1');
    jest
      .mocked(getDashboardDiagnosticsStatus)
      .mockResolvedValue({ uid: 'job-1', state: 'complete', panelsDone: 2, panelsTotal: 2 });
    jest.mocked(downloadDashboardDiagnostics).mockResolvedValue(undefined);
    const { tab } = setupScenario();

    render(<tab.Component model={tab} />);
    await userEvent.click(screen.getByRole('button', { name: 'Download diagnostics' }));

    expect(await screen.findByRole('button', { name: 'Download diagnostics' })).toBeInTheDocument();
    expect(downloadDashboardDiagnostics).toHaveBeenCalledWith('job-1', expect.anything());

    // Only the two data panels are sent; the text panel (no active queries) is skipped.
    const [panels] = jest.mocked(startDashboardDiagnostics).mock.calls[0];
    expect(panels.map((p) => p.title)).toEqual(['Panel A', 'Panel B']);
  });

  it('interpolates each panel’s queries before posting, scoped to that panel', async () => {
    interpolateVariablesInQueries.mockImplementation((queries: DataQuery[]) =>
      queries.map((q) => ({ ...q, expr: (q as { expr?: string }).expr?.replace('$job', 'grafana') }))
    );
    jest.mocked(startDashboardDiagnostics).mockResolvedValue('job-1');
    jest
      .mocked(getDashboardDiagnosticsStatus)
      .mockResolvedValue({ uid: 'job-1', state: 'complete', panelsDone: 1, panelsTotal: 1 });
    const { tab } = setupTemplatedScenario();

    render(<tab.Component model={tab} />);
    await userEvent.click(screen.getByRole('button', { name: 'Download diagnostics' }));

    await screen.findByRole('button', { name: 'Download diagnostics' });

    const [panels] = jest.mocked(startDashboardDiagnostics).mock.calls[0];
    // The resolved query, not the literal $job, is captured for the panel (WMD1 / #1530).
    expect(panels[0].queries).toEqual([
      { refId: 'A', datasource: { uid: 'prom', type: 'prometheus' }, expr: 'up{job="grafana"}' },
    ]);
    // scopedVars carries the panel so scene variables (incl. repeat-local values) resolve.
    expect(interpolateVariablesInQueries.mock.calls[0][1]?.__sceneObject).toBeDefined();
  });

  it('shows the generation-failed alert when the job errors out', async () => {
    jest.mocked(startDashboardDiagnostics).mockResolvedValue('job-1');
    jest
      .mocked(getDashboardDiagnosticsStatus)
      .mockResolvedValue({ uid: 'job-1', state: 'error', panelsDone: 0, panelsTotal: 2, error: 'boom' });
    const { tab } = setupScenario();

    render(<tab.Component model={tab} />);
    await userEvent.click(screen.getByRole('button', { name: 'Download diagnostics' }));

    expect(await screen.findByText('boom')).toBeInTheDocument();
    expect(downloadDashboardDiagnostics).not.toHaveBeenCalled();
  });

  it('shows a message and does not start a job when no panel has active queries', async () => {
    const { tab } = setupScenario({ onlyEmptyPanels: true });

    render(<tab.Component model={tab} />);
    await userEvent.click(screen.getByRole('button', { name: 'Download diagnostics' }));

    expect(await screen.findByText('This dashboard has no panels with active queries.')).toBeInTheDocument();
    expect(startDashboardDiagnostics).not.toHaveBeenCalled();
  });

  it('calls onDismiss when cancelled', async () => {
    const onDismiss = jest.fn();
    jest.mocked(startDashboardDiagnostics).mockImplementation(() => new Promise(() => {})); // never resolves
    const { tab } = setupScenario({ onDismiss });

    render(<tab.Component model={tab} />);
    await userEvent.click(screen.getByRole('button', { name: 'Download diagnostics' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(downloadDashboardDiagnostics).not.toHaveBeenCalled();
  });

  it('sends one entry per repeat-by-variable clone, all carrying the source panel id', async () => {
    jest.mocked(startDashboardDiagnostics).mockResolvedValue('job-1');
    jest
      .mocked(getDashboardDiagnosticsStatus)
      .mockResolvedValue({ uid: 'job-1', state: 'complete', panelsDone: 2, panelsTotal: 2 });
    const { tab } = setupCloneScenario();

    render(<tab.Component model={tab} />);
    await userEvent.click(screen.getByRole('button', { name: 'Download diagnostics' }));

    await screen.findByRole('button', { name: 'Download diagnostics' });

    // Repeat clones aren't serialized as separate elements in dashboard.getSaveModel(), so the id
    // sent for each clone must match the one source panel the backend can actually resolve --
    // fabricating a distinct id per clone would leave it unable to find panel JSON for any of them.
    const [panels] = jest.mocked(startDashboardDiagnostics).mock.calls[0];
    expect(panels.map((p) => p.id)).toEqual([3, 3]);
    expect(panels.map((p) => p.title)).toEqual(['Repeated panel', 'Repeated panel']);
  });
});

function setupScenario(opts: { onDismiss?: () => void; onlyEmptyPanels?: boolean } = {}) {
  const { onDismiss, onlyEmptyPanels } = opts;

  const panelA = new VizPanel({
    key: 'panel-1',
    pluginId: 'table',
    title: 'Panel A',
    $data: new SceneQueryRunner({ queries: onlyEmptyPanels ? [] : [{ refId: 'A' }] }),
  });
  const panelB = new VizPanel({
    key: 'panel-2',
    pluginId: 'table',
    title: 'Panel B',
    $data: new SceneQueryRunner({ queries: onlyEmptyPanels ? [] : [{ refId: 'A' }] }),
  });
  // A panel with no query runner at all (e.g. a text panel) should be skipped, not crash.
  const textPanel = new VizPanel({ key: 'panel-3', pluginId: 'text', title: 'Text panel' });

  const dashboard = new DashboardScene({
    title: 'Dash',
    uid: 'dash-1',
    meta: { canEdit: true },
    $timeRange: new SceneTimeRange({}),
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [
          new DashboardGridItem({ key: 'grid-item-1', body: panelA }),
          new DashboardGridItem({ key: 'grid-item-2', body: panelB }),
          new DashboardGridItem({ key: 'grid-item-3', body: textPanel }),
        ],
      }),
    }),
  });

  // Constructing the scene wires up parent pointers, which is all sceneGraph.getTimeRange and the
  // query-runner lookup need here. We deliberately skip activation so the SceneQueryRunners do not
  // try to execute (and fail) their queries against a real datasource.
  const tab = new DownloadDashboardDiagnostics({ dashboardRef: dashboard.getRef(), onDismiss });

  return { tab, dashboard };
}

function setupTemplatedScenario() {
  const panel = new VizPanel({
    key: 'panel-1',
    pluginId: 'table',
    title: 'Templated panel',
    $data: new SceneQueryRunner({
      datasource: { uid: 'prom', type: 'prometheus' },
      queries: [{ refId: 'A', expr: 'up{job="$job"}' }],
    }),
  });

  const dashboard = new DashboardScene({
    title: 'Dash',
    uid: 'dash-1',
    meta: { canEdit: true },
    $timeRange: new SceneTimeRange({}),
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({ children: [new DashboardGridItem({ key: 'grid-item-1', body: panel })] }),
    }),
  });

  const tab = new DownloadDashboardDiagnostics({ dashboardRef: dashboard.getRef() });

  return { tab, dashboard };
}

function setupCloneScenario() {
  // Mirrors how repeat-by-variable actually keys clones: the source panel's own key, suffixed with
  // `-clone-<n>` (see dashboard-scene/utils/clone.ts). Both clones below parse to base id 3.
  const source = new VizPanel({
    key: 'panel-3',
    pluginId: 'table',
    title: 'Repeated panel',
    $data: new SceneQueryRunner({ queries: [{ refId: 'A' }] }),
  });
  const clone = new VizPanel({
    key: 'panel-3-clone-1',
    pluginId: 'table',
    title: 'Repeated panel',
    $data: new SceneQueryRunner({ queries: [{ refId: 'A' }] }),
  });

  const dashboard = new DashboardScene({
    title: 'Dash',
    uid: 'dash-1',
    meta: { canEdit: true },
    $timeRange: new SceneTimeRange({}),
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [
          new DashboardGridItem({ key: 'grid-item-1', body: source }),
          new DashboardGridItem({ key: 'grid-item-2', body: clone }),
        ],
      }),
    }),
  });

  const tab = new DownloadDashboardDiagnostics({ dashboardRef: dashboard.getRef() });

  return { tab, dashboard };
}
