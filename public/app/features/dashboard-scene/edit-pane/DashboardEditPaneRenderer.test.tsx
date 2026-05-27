import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { setPluginImportUtils, config } from '@grafana/runtime';
import { SceneGridLayout, SceneTimeRange, SceneVariableSet, VizPanel } from '@grafana/scenes';

import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { DashboardScene } from '../scene/DashboardScene';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { DashboardInteractions } from '../utils/interactions';
import { activateFullSceneTree } from '../utils/test-utils';

import { DashboardEditPaneSplitter } from './DashboardEditPaneSplitter';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

jest.mock('app/core/hooks/useMediaQueryMinWidth', () => ({
  useMediaQueryMinWidth: () => true,
}));

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

jest.mock('@grafana/assistant', () => ({
  useAssistant: jest.fn().mockReturnValue({
    isAvailable: false,
    isLoading: false,
    openAssistant: jest.fn(),
    closeAssistant: jest.fn(),
    toggleAssistant: jest.fn(),
  }),
}));

jest.mock('app/core/components/AppChrome/ExtensionSidebar/ExtensionSidebarProvider', () => ({
  useExtensionSidebarContext: jest.fn().mockReturnValue({
    isOpen: false,
    dockedComponentId: undefined,
    setDockedComponentId: jest.fn(),
    availableComponents: new Map(),
    extensionSidebarWidth: 400,
    setExtensionSidebarWidth: jest.fn(),
  }),
}));

export function buildTestScene() {
  const testScene = new DashboardScene({
    $variables: new SceneVariableSet({ variables: [] }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    $data: new DashboardDataLayerSet({ annotationLayers: [] }),
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
    // Sidebar state is persisted to localStorage — clear between tests so each test
    // starts with the default visibility/dock state.
    window.localStorage.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  it('Should render sidebar', async () => {
    const scene = buildTestScene();

    act(() => activateFullSceneTree(scene));

    render(<DashboardEditPaneSplitter dashboard={scene} />);

    expect(await screen.findByTestId(selectors.pages.Dashboard.Sidebar.outlineButton)).toBeInTheDocument();
  });

  it('Should sync sidebar docked state with edit pane state', async () => {
    const scene = buildTestScene();

    act(() => activateFullSceneTree(scene));

    render(<DashboardEditPaneSplitter dashboard={scene} isEditing />);

    act(() => screen.getByLabelText('Outline').click());

    expect(await screen.findByTestId(selectors.components.Sidebar.dockToggle)).toBeInTheDocument();

    // With defaultToDocked: true when editing, sidebar starts docked
    expect(scene.state.editPane.state.isDocked).toBe(true);

    // Clicking dock toggle should undock the sidebar
    act(() => screen.getByTestId(selectors.components.Sidebar.dockToggle).click());

    expect(scene.state.editPane.state.isDocked).toBe(false);
  });

  describe('outline interactions tracking', () => {
    it('should call DashboardInteractions.outlineClicked when clicking on dashboard outline', async () => {
      const user = userEvent.setup();
      const scene = buildTestScene();

      act(() => activateFullSceneTree(scene));

      render(<DashboardEditPaneSplitter dashboard={scene} isEditing />);
      const outlineButton = screen.getByTestId(selectors.pages.Dashboard.Sidebar.outlineButton);
      await user.click(outlineButton);
      expect(DashboardInteractions.dashboardOutlineClicked).toHaveBeenCalled();
    });
  });

  describe('hide button', () => {
    it('renders the hide button in view mode', async () => {
      const scene = buildTestScene();
      scene.setState({ isEditing: false });
      act(() => activateFullSceneTree(scene));

      render(<DashboardEditPaneSplitter dashboard={scene} />);

      const hideButton = await screen.findByTestId(selectors.components.Sidebar.showHideToggle);
      expect(hideButton).toBeInTheDocument();
    });

    it('renders the hide button in edit mode', async () => {
      const scene = buildTestScene();
      act(() => activateFullSceneTree(scene));

      render(<DashboardEditPaneSplitter dashboard={scene} isEditing />);

      const hideButton = await screen.findByTestId(selectors.components.Sidebar.showHideToggle);
      expect(hideButton).toBeInTheDocument();
    });

    it('hides the sidebar and clears any open pane on click', async () => {
      const user = userEvent.setup();
      const scene = buildTestScene();
      act(() => activateFullSceneTree(scene));

      render(<DashboardEditPaneSplitter dashboard={scene} isEditing />);

      // Open the outline pane first
      await user.click(screen.getByTestId(selectors.pages.Dashboard.Sidebar.outlineButton));
      expect(scene.state.editPane.state.openPane).toBeDefined();

      // Click hide
      await user.click(screen.getByTestId(selectors.components.Sidebar.showHideToggle));

      // Pane should be cleared
      expect(scene.state.editPane.state.openPane).toBeUndefined();
      // The sidebar container should no longer be rendered (only the show toggle remains)
      expect(screen.queryByTestId(selectors.components.Sidebar.container)).not.toBeInTheDocument();
    });

    it('temporarily shows the sidebar undocked when selecting a panel while hidden', async () => {
      const user = userEvent.setup();
      const scene = buildTestScene();
      act(() => activateFullSceneTree(scene));

      render(<DashboardEditPaneSplitter dashboard={scene} isEditing />);

      // Hide the sidebar
      await user.click(screen.getByTestId(selectors.components.Sidebar.showHideToggle));
      expect(screen.queryByTestId(selectors.components.Sidebar.container)).not.toBeInTheDocument();

      // Select the panel programmatically (clicking a panel in real UX)
      const panel = scene.state.body.getVizPanels()[0];
      act(() => scene.state.editPane.selectObject(panel));

      // Sidebar pops up — effective isDocked is false during temp-show
      expect(screen.getByTestId(selectors.components.Sidebar.container)).toBeInTheDocument();
      expect(scene.state.editPane.state.isDocked).toBe(false);

      // De-selecting closes the pane and re-hides the sidebar
      act(() => scene.state.editPane.clearSelection(true));

      expect(screen.queryByTestId(selectors.components.Sidebar.container)).not.toBeInTheDocument();
    });
  });
});
