import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneGridLayout, SceneTimeRange, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { AutoGridItem } from '../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../scene/layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { activateFullSceneTree } from '../utils/test-utils';

import { ShareLibraryPanelTab } from './ShareLibraryPanelTab';

jest.mock('app/features/dashboard/components/ShareModal/ShareLibraryPanel', () => ({
  // eslint-disable-next-line react/display-name
  ShareLibraryPanel: ({ panel }: { panel: { title: string } }) => (
    <div data-testid="share-library-panel">panel-title:{panel.title}</div>
  ),
}));

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

describe('ShareLibraryPanelTab', () => {
  it('renders library panel content for auto grid panels', () => {
    const { tab } = setupAutoGridScenario();

    render(<tab.Component model={tab} />);

    expect(screen.getByTestId('share-library-panel')).toHaveTextContent('panel-title:Auto panel');
  });

  it('renders library panel content for default grid panels', () => {
    const { tab } = setupDefaultGridScenario();

    render(<tab.Component model={tab} />);

    expect(screen.getByTestId('share-library-panel')).toHaveTextContent('panel-title:Default panel');
  });
});

function setupAutoGridScenario() {
  const vizPanel = new VizPanel({
    key: 'panel-1',
    pluginId: 'table',
    title: 'Auto panel',
  });

  const autoGridItem = new AutoGridItem({
    key: 'auto-grid-item-1',
    body: vizPanel,
  });

  const layoutManager = new AutoGridLayoutManager({
    layout: new AutoGridLayout({ children: [autoGridItem] }),
  });

  const tab = new ShareLibraryPanelTab({
    panelRef: vizPanel.getRef(),
  });

  const dashboard = new DashboardScene({
    title: 'Dash',
    uid: 'dash-1',
    meta: { canEdit: true },
    $timeRange: new SceneTimeRange({}),
    body: layoutManager,
    overlay: tab,
  });

  activateFullSceneTree(dashboard);

  return { tab, dashboard };
}

function setupDefaultGridScenario() {
  const vizPanel = new VizPanel({
    key: 'panel-1',
    pluginId: 'table',
    title: 'Default panel',
  });

  const gridItem = new DashboardGridItem({
    key: 'grid-item-1',
    body: vizPanel,
  });

  const tab = new ShareLibraryPanelTab({
    panelRef: vizPanel.getRef(),
  });

  const dashboard = new DashboardScene({
    title: 'Dash',
    uid: 'dash-1',
    meta: { canEdit: true },
    $timeRange: new SceneTimeRange({}),
    body: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [gridItem] }) }),
    overlay: tab,
  });

  activateFullSceneTree(dashboard);

  return { tab, dashboard };
}
