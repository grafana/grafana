import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneGridLayout, SceneQueryRunner, SceneTimeRange, VizPanel } from '@grafana/scenes';
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

  it('calls onDismiss when cancelled', async () => {
    const onDismiss = jest.fn();
    const { tab } = setupScenario(onDismiss);

    render(<tab.Component model={tab} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

function setupScenario(onDismiss?: () => void) {
  const vizPanel = new VizPanel({
    key: 'panel-1',
    pluginId: 'table',
    title: 'Panel',
    $data: new SceneQueryRunner({
      queries: [{ refId: 'A' }, { refId: 'B', hide: true }],
    }),
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
