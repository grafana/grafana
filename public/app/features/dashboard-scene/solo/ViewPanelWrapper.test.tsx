import { act } from '@testing-library/react';
import { type MemoryHistoryBuildOptions } from 'history';
import { render } from 'test/test-utils';

import { LoadingState, getDefaultTimeRange, store } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneDataNode, SceneGridLayout, SceneTimeRange, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { ToggleViewPanePaneEvent } from '../sidebar/events';
import { activateFullSceneTree } from '../utils/test-utils';

import { VIEW_PANEL_PANE_CLOSED_KEY, ViewPanelWrapper } from './ViewPanelWrapper';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

jest.mock('app/core/hooks/useMediaQueryMinWidth', () => ({
  useMediaQueryMinWidth: () => true,
}));

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  useFlagGrafanaViewPanelPane: jest.fn().mockReturnValue(true),
}));

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
