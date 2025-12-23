import { act, screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { setPluginImportUtils, config } from '@grafana/runtime';
import { SceneGridLayout, SceneTimeRange, SceneVariableSet, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { activateFullSceneTree } from '../utils/test-utils';

import { DashboardEditPaneSplitter } from './DashboardEditPaneSplitter';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

jest.mock('../utils/interactions', () => ({
  DashboardInteractions: {
    dashboardOutlineClicked: jest.fn(),
    outlineItemClicked: jest.fn(),
  },
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useChromeHeaderHeight: jest.fn().mockReturnValue(80),
}));

export function buildTestScene() {
  const testScene = new DashboardScene({
    $variables: new SceneVariableSet({ variables: [] }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    isEditing: true,
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [new DashboardGridItem({ body: new VizPanel({ key: 'panel-1', pluginId: 'text' }) })],
      }),
    }),
  });
  return testScene;
}

describe('DashboardEditPaneRenderer', () => {
  config.featureToggles.dashboardNewLayouts = true;

  it('Should render sidebar', async () => {
    const scene = buildTestScene();

    act(() => activateFullSceneTree(scene));

    render(<DashboardEditPaneSplitter dashboard={scene} />);

    expect(await screen.findByTestId(selectors.pages.Dashboard.Sidebar.outlineButton)).toBeInTheDocument();
  });

  it('Should sync sidebar docked state with edit pane state', async () => {
    const scene = buildTestScene();
    render(<DashboardEditPaneSplitter dashboard={scene} />);

    act(() => screen.getByLabelText('Outline').click());

    expect(await screen.findByTestId(selectors.components.Sidebar.dockToggle)).toBeInTheDocument();

    act(() => screen.getByTestId(selectors.components.Sidebar.dockToggle).click());

    expect(scene.state.editPane.state.isDocked).toBe(true);
  });

  // describe('outline interactions tracking', () => {
  //   it('should call DashboardInteractions.outlineClicked when clicking on dashboard outline', async () => {
  //     const user = userEvent.setup();
  //     const scene = buildTestScene();
  //     render(<DashboardEditPaneRenderer editPane={scene.state.editPane} dashboard={scene} />);
  //     const outlineButton = screen.getByTestId(selectors.components.PanelEditor.Outline.section);
  //     await user.click(outlineButton);
  //     expect(DashboardInteractions.dashboardOutlineClicked).toHaveBeenCalled();
  //   });
  // });
});
