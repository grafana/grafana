import { act, screen } from '@testing-library/react';
import { render, waitFor } from 'test/test-utils';

import { createTheme } from '@grafana/data';
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

jest.mock('./useUserActivity', () => ({
  useUserActivity: jest.fn().mockReturnValue(true),
}));

const mockUseUserActivity = jest.requireMock('./useUserActivity').useUserActivity;

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
  beforeEach(() => {
    config.featureToggles.dashboardNewLayouts = true;
    mockUseUserActivity.mockReturnValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

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

  describe('User Activity', () => {
    it('should hide sidebar when user is inactive', async () => {
      mockUseUserActivity.mockReturnValue(false);
      const scene = buildTestScene();
      act(() => activateFullSceneTree(scene));
      render(<DashboardEditPaneSplitter dashboard={scene} />);
      await waitFor(() =>
        expect(screen.getByTestId(selectors.components.DashboardEditPaneSplitter.primaryBody)).toBeInTheDocument()
      );
      expect(screen.queryByTestId(selectors.pages.Dashboard.Sidebar.outlineButton)).not.toBeInTheDocument();
    });

    it('should toggle sidebar visibility based on user activity', async () => {
      const scene = buildTestScene();
      act(() => activateFullSceneTree(scene));
      const { rerender } = render(<DashboardEditPaneSplitter dashboard={scene} />);
      await waitFor(() =>
        expect(screen.getByTestId(selectors.pages.Dashboard.Sidebar.outlineButton)).toBeInTheDocument()
      );
      mockUseUserActivity.mockReturnValue(false);
      await act(async () => rerender(<DashboardEditPaneSplitter dashboard={scene} />));
      await waitFor(() =>
        expect(screen.queryByTestId(selectors.pages.Dashboard.Sidebar.outlineButton)).not.toBeInTheDocument()
      );
      mockUseUserActivity.mockReturnValue(true);
      await act(async () => rerender(<DashboardEditPaneSplitter dashboard={scene} />));
      await waitFor(() =>
        expect(screen.getByTestId(selectors.pages.Dashboard.Sidebar.outlineButton)).toBeInTheDocument()
      );
    });

    it('should apply correct padding', async () => {
      const theme = createTheme();
      const scene = buildTestScene();
      act(() => activateFullSceneTree(scene));
      const { rerender } = render(<DashboardEditPaneSplitter dashboard={scene} />);
      await waitFor(() =>
        expect(screen.getByTestId(selectors.components.DashboardEditPaneSplitter.primaryBody)).toBeInTheDocument()
      );
      expect(
        window.getComputedStyle(screen.getByTestId(selectors.components.DashboardEditPaneSplitter.bodyContainer))
          .paddingRight
      ).toBe(theme.spacing(1));
      mockUseUserActivity.mockReturnValue(false);
      await act(async () => rerender(<DashboardEditPaneSplitter dashboard={scene} />));
      await waitFor(() =>
        expect(screen.getByTestId(selectors.components.DashboardEditPaneSplitter.primaryBody)).toBeInTheDocument()
      );
      expect(
        window.getComputedStyle(screen.getByTestId(selectors.components.DashboardEditPaneSplitter.bodyContainer))
          .paddingRight
      ).toBe(theme.spacing(2));
    });
  });
});
