import { act, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { render } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneGridLayout, VizPanel } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { Sidebar, useSidebar } from '@grafana/ui';

import { DashboardScene } from '../scene/DashboardScene';
import { type DashboardMode } from '../scene/dashboardModes';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { activateFullSceneTree } from '../utils/test-utils';

import { ViewPanelSidePane } from './ViewPanelSidePane';

const plugin = getPanelPlugin({ id: 'quick-toggles' })
  .setPanelOptions((builder) =>
    builder.addBooleanSwitch({
      path: 'legend.showLegend',
      name: 'Show legend',
      category: ['Legend'],
      defaultValue: true,
    })
  )
  .setViewPanelOptions({ quickToggles: { optionProperties: ['legend.showLegend'], fieldConfigProperties: [] } });

setPluginImportUtils({ importPanelPlugin: async () => plugin, getPanelPluginFromCache: () => plugin });

jest.mock('app/features/plugins/importPanelPlugin', () => ({
  importPanelPlugin: () => Promise.resolve(plugin),
}));

async function setup(mode: DashboardMode) {
  const panel = new VizPanel({ key: 'panel-1', pluginId: 'quick-toggles' });
  const dashboard = new DashboardScene({
    mode,
    isEditing: mode !== 'view',
    viewPanel: 'panel-1',
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({ children: [new DashboardGridItem({ body: panel })] }),
    }),
  });
  activateFullSceneTree(dashboard);
  const pane = new ViewPanelSidePane({ panelRef: panel.getRef() });
  dashboard.state.sidebar.openPane(pane);

  render(
    <WrapSidebar>
      <pane.Component model={pane} />
    </WrapSidebar>
  );
  await act(async () => {});
}

function WrapSidebar({ children }: { children: ReactNode }) {
  const sidebarContext = useSidebar({});
  return <Sidebar contextValue={sidebarContext}>{children}</Sidebar>;
}

describe('ViewPanelSidePane', () => {
  beforeEach(() => {
    setTestFlags({ dashboardNewLayouts: true, 'grafana.dashboardPreviewMode': true });
  });

  afterEach(() => {
    setTestFlags({});
  });

  it.each(['view', 'edit', 'composer'] as const)('shows the quick toggles in %s mode', async (mode) => {
    await setup(mode);

    expect(screen.getByText('Show legend')).toBeInTheDocument();
  });
});
