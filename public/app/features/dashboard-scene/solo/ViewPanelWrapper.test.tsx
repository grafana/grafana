import { type ReactNode } from 'react';
import { act, render, screen } from 'test/test-utils';

import { getDefaultTimeRange, LoadingState, type PanelPlugin } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { SceneDataNode, VizPanel } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { Sidebar, useSidebar } from '@grafana/ui';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { hasViewPanelPaneContent, ViewPanelSidePane } from './ViewPanelSidePane';
import { ViewPanelWrapper } from './ViewPanelWrapper';

let mockPlugin: PanelPlugin = getPanelPlugin({ id: 'test-panel' });

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(mockPlugin),
  getPanelPluginFromCache: () => mockPlugin,
});

jest.mock('app/features/plugins/importPanelPlugin', () => ({
  importPanelPlugin: () => Promise.resolve(mockPlugin),
}));

jest.mock('app/core/hooks/useMediaQueryMinWidth', () => ({
  useMediaQueryMinWidth: () => true,
}));

function pluginWithViewPanelOptions() {
  return getPanelPlugin({ id: 'test-panel' }).setViewPanelOptions({
    quickToggles: { optionProperties: ['legend.showLegend'], fieldConfigProperties: [] },
  });
}

function setup() {
  const panel = new VizPanel({
    title: 'Test panel',
    pluginId: 'test-panel',
    key: 'panel-1',
    $data: new SceneDataNode({
      data: { series: [], state: LoadingState.Done, timeRange: getDefaultTimeRange() },
    }),
  });
  const dashboard = new DashboardScene({
    viewPanel: 'panel-1',
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
  });
  const openPane = jest.spyOn(dashboard.state.sidebar, 'openPane');

  return { panel, dashboard, openPane };
}

async function setFlags(flags: Record<string, boolean>) {
  await act(async () => {
    setTestFlags(flags);
  });
}

describe('hasViewPanelPaneContent', () => {
  it('is true when the panel plugin has view panel options', () => {
    mockPlugin = pluginWithViewPanelOptions();
    const { panel } = setup();
    panel.activate();

    expect(hasViewPanelPaneContent(panel)).toBe(true);
  });

  it('is false when the panel plugin has no view panel options', () => {
    mockPlugin = getPanelPlugin({ id: 'test-panel' });
    const { panel } = setup();
    panel.activate();

    expect(hasViewPanelPaneContent(panel)).toBe(false);
  });
});

describe('<ViewPanelWrapper />', () => {
  afterEach(async () => {
    await setFlags({});
  });

  describe('when grafana.panelActionsPopover is on', () => {
    beforeEach(async () => {
      await setFlags({ [FlagKeys.GrafanaViewPanelPane]: true, [FlagKeys.GrafanaPanelActionsPopover]: true });
    });

    it('does not open the view panel pane for a plugin without view panel options', async () => {
      mockPlugin = getPanelPlugin({ id: 'test-panel' });
      const { panel, openPane } = setup();

      render(<ViewPanelWrapper panel={panel} showControlsPane />);
      await act(async () => {});

      expect(openPane).not.toHaveBeenCalled();
    });

    it('opens the view panel pane for a plugin with view panel options', async () => {
      mockPlugin = pluginWithViewPanelOptions();
      const { panel, openPane } = setup();

      render(<ViewPanelWrapper panel={panel} showControlsPane />);
      await act(async () => {});

      expect(openPane).toHaveBeenCalledWith(expect.any(ViewPanelSidePane));
    });
  });

  describe('when grafana.panelActionsPopover is off', () => {
    it('opens the view panel pane for a plugin without view panel options', async () => {
      await setFlags({ [FlagKeys.GrafanaViewPanelPane]: true });
      mockPlugin = getPanelPlugin({ id: 'test-panel' });
      const { panel, openPane } = setup();

      render(<ViewPanelWrapper panel={panel} showControlsPane />);
      await act(async () => {});

      expect(openPane).toHaveBeenCalledWith(expect.any(ViewPanelSidePane));
    });
  });
});

describe('<ViewPanelSidePane />', () => {
  afterEach(async () => {
    await setFlags({});
  });

  function renderPane() {
    const { panel, dashboard } = setup();
    const pane = new ViewPanelSidePane({ panelRef: panel.getRef() });
    dashboard.state.sidebar.openPane(pane);
    return render(
      <WrapSidebar>
        <pane.Component model={pane} />
      </WrapSidebar>
    );
  }

  function WrapSidebar({ children }: { children: ReactNode }) {
    const sidebarContext = useSidebar({});
    return <Sidebar contextValue={sidebarContext}>{children}</Sidebar>;
  }

  it('shows Back to dashboard when grafana.panelActionsPopover is off', async () => {
    mockPlugin = pluginWithViewPanelOptions();
    renderPane();

    expect(await screen.findByRole('button', { name: 'Back to dashboard' })).toBeInTheDocument();
  });

  it('does not show Back to dashboard when grafana.panelActionsPopover is on', async () => {
    await setFlags({ [FlagKeys.GrafanaPanelActionsPopover]: true });
    mockPlugin = pluginWithViewPanelOptions();
    renderPane();

    expect(await screen.findByText('View panel')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back to dashboard' })).not.toBeInTheDocument();
  });
});
