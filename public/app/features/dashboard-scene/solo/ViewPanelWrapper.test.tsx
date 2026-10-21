import { type MemoryHistoryBuildOptions } from 'history';
import { type ReactNode } from 'react';
import { act, render, screen } from 'test/test-utils';

import { getDefaultTimeRange, LoadingState, type PanelPlugin, store } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { SceneDataNode, SceneGridLayout, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { Sidebar, useSidebar } from '@grafana/ui';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { ToggleViewPanePaneEvent } from '../sidebar/events';
import { activateFullSceneTree } from '../utils/test-utils';

import { hasViewPanelPaneContent, ViewPanelSidePane } from './ViewPanelSidePane';
import { VIEW_PANEL_PANE_CLOSED_KEY, ViewPanelWrapper } from './ViewPanelWrapper';

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

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  useFlagGrafanaViewPanelPane: jest.fn().mockReturnValue(true),
}));

function pluginWithViewPanelOptions() {
  return getPanelPlugin({ id: 'test-panel' }).setViewPanelOptions({
    quickToggles: { optionProperties: ['legend.showLegend'], fieldConfigProperties: [] },
  });
}

function setupViewedPanel() {
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
    const { panel } = setupViewedPanel();
    panel.activate();

    expect(hasViewPanelPaneContent(panel)).toBe(true);
  });

  it('is false when the panel plugin has no view panel options', () => {
    mockPlugin = getPanelPlugin({ id: 'test-panel' });
    const { panel } = setupViewedPanel();
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
      const { panel, openPane } = setupViewedPanel();

      render(<ViewPanelWrapper panel={panel} showControlsPane />);
      await act(async () => {});

      expect(openPane).not.toHaveBeenCalled();
    });

    it('opens the view panel pane for a plugin with view panel options', async () => {
      mockPlugin = pluginWithViewPanelOptions();
      const { panel, openPane } = setupViewedPanel();

      render(<ViewPanelWrapper panel={panel} showControlsPane />);
      await act(async () => {});

      expect(openPane).toHaveBeenCalledWith(expect.any(ViewPanelSidePane));
    });
  });

  describe('when grafana.panelActionsPopover is off', () => {
    it('opens the view panel pane for a plugin without view panel options', async () => {
      await setFlags({ [FlagKeys.GrafanaViewPanelPane]: true });
      mockPlugin = getPanelPlugin({ id: 'test-panel' });
      const { panel, openPane } = setupViewedPanel();

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
    const { panel, dashboard } = setupViewedPanel();
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

function buildTestScene() {
  const panel = new VizPanel({
    key: 'panel-1',
    pluginId: 'text',
    $data: new SceneDataNode({
      data: { state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() },
    }),
  });

  const dashboard = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    viewPanel: 'panel-1',
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [new DashboardGridItem({ body: panel })],
      }),
    }),
  });

  return { dashboard, panel };
}

async function setup(historyOptions?: MemoryHistoryBuildOptions) {
  const { dashboard, panel } = buildTestScene();
  const deactivate = activateFullSceneTree(dashboard);

  const renderResult = render(<ViewPanelWrapper panel={panel} showControlsPane={true} />, { historyOptions });

  // Let the async panel plugin load settle
  await act(async () => {});

  return { dashboard, sidebar: dashboard.state.sidebar, panel, deactivate, renderResult };
}

describe('ViewPanelWrapper', () => {
  beforeEach(() => {
    mockPlugin = getPanelPlugin({});
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('opens the pane on mount by default', async () => {
    const { sidebar } = await setup();

    expect(sidebar.state.openPane?.getId()).toBe('view-panel-pane');
  });

  it('does not open the pane when the user closed it before', async () => {
    store.set(VIEW_PANEL_PANE_CLOSED_KEY, true);

    const { sidebar } = await setup();

    expect(sidebar.state.openPane).toBeUndefined();
  });

  it('opens the pane for a fanout url param without clearing the remembered close', async () => {
    store.set(VIEW_PANEL_PANE_CLOSED_KEY, true);

    const { sidebar } = await setup({ initialEntries: ['/?fanout=$__by_series__$'] });

    expect(sidebar.state.openPane?.getId()).toBe('view-panel-pane');
    // The forced open is not the user's choice, so the next panel view still starts closed
    expect(store.getBool(VIEW_PANEL_PANE_CLOSED_KEY, false)).toBe(true);
  });

  it('remembers when the user closes the pane in view mode', async () => {
    const { sidebar } = await setup();

    act(() => sidebar.closePane('explicit'));

    expect(store.getBool(VIEW_PANEL_PANE_CLOSED_KEY, false)).toBe(true);
  });

  it('does not remember a programmatic close while the panel is still viewed', async () => {
    const { sidebar } = await setup();

    // e.g. a dashboard rebuild closing whatever pane is open
    act(() => sidebar.closePane());

    expect(sidebar.state.openPane).toBeUndefined();
    expect(store.getBool(VIEW_PANEL_PANE_CLOSED_KEY, false)).toBe(false);
  });

  it('does not remember a click-away close', async () => {
    const { sidebar } = await setup();

    act(() => sidebar.closePane('click-away'));

    expect(sidebar.state.openPane).toBeUndefined();
    expect(store.getBool(VIEW_PANEL_PANE_CLOSED_KEY, false)).toBe(false);
  });

  it('clears the remembered close when the pane is reopened from the sidebar button', async () => {
    store.set(VIEW_PANEL_PANE_CLOSED_KEY, true);

    const { sidebar } = await setup();

    act(() => sidebar.publishEvent(new ToggleViewPanePaneEvent()));

    expect(sidebar.state.openPane?.getId()).toBe('view-panel-pane');
    expect(store.getBool(VIEW_PANEL_PANE_CLOSED_KEY, false)).toBe(false);
  });

  it('does not remember a close once view mode has been left, whatever the reason', async () => {
    const { dashboard, sidebar } = await setup();

    act(() => {
      dashboard.setState({ viewPanel: undefined });
      sidebar.closePane('explicit');
    });

    expect(store.getBool(VIEW_PANEL_PANE_CLOSED_KEY, false)).toBe(false);
  });
});
