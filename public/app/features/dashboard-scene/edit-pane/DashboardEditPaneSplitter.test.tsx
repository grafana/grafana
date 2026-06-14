import { act, render as renderElement, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { setPluginImportUtils, config } from '@grafana/runtime';
import { SceneGridLayout, SceneTimeRange, SceneVariableSet, VizPanel } from '@grafana/scenes';
import { AppChromeService } from 'app/core/components/AppChrome/AppChromeService';

import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { DashboardScene } from '../scene/DashboardScene';
import { AutoGridLayoutManager } from '../scene/layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { dynamicDashNavActions, registerDynamicDashNavAction } from '../utils/registerDynamicDashNavAction';
import { activateFullSceneTree } from '../utils/test-utils';

import { DashboardEditPaneSplitter } from './DashboardEditPaneSplitter';

function MockDynamicLeftAction() {
  return <div data-testid="dynamic-left-action">dynamic action</div>;
}

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

jest.mock('app/core/hooks/useMediaQueryMinWidth', () => ({
  useMediaQueryMinWidth: () => true,
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

jest.mock('../scene/new-toolbar/actions/StarButton', () => ({
  StarButton: () => <div data-testid="star-button" />,
}));

jest.mock('../scene/new-toolbar/actions/PublicDashboardBadge', () => ({
  PublicDashboardBadge: () => null,
}));

const autoLayoutInputs = [
  selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.minColumnWidth,
  selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.maxColumns,
  selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.rowHeight,
  selectors.components.PanelEditor.ElementEditPane.AutoGridLayout.fillScreen,
];

function countBreadcrumbActionUpdates(updateSpy: jest.SpyInstance) {
  return updateSpy.mock.calls.filter((call) => call[0]?.breadcrumbActions !== undefined).length;
}

function renderBreadcrumbActions(chrome: AppChromeService) {
  const breadcrumbActions = chrome.state.getValue().breadcrumbActions;
  expect(breadcrumbActions).toBeDefined();
  return renderElement(<>{breadcrumbActions}</>);
}

describe('DashboardEditPaneSplitter', () => {
  beforeEach(() => {
    config.featureToggles.dashboardNewLayouts = true;
    dynamicDashNavActions.left = [];
    dynamicDashNavActions.right = [];
    window.localStorage.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  describe('breadcrumb chrome actions', () => {
    it('should update chrome with breadcrumb actions', () => {
      const chrome = new AppChromeService();
      const updateSpy = jest.spyOn(chrome, 'update');
      const scene = buildViewModeScene();

      act(() => activateFullSceneTree(scene));
      render(<DashboardEditPaneSplitter dashboard={scene} />, { grafanaContext: { chrome } });

      expect(countBreadcrumbActionUpdates(updateSpy)).toBe(1);
      expect(chrome.state.getValue().breadcrumbActions).toBeDefined();
    });

    it('should include registered dynamic left actions in breadcrumb actions', () => {
      registerDynamicDashNavAction('left', {
        show: () => true,
        component: MockDynamicLeftAction,
      });

      const chrome = new AppChromeService();
      const scene = buildViewModeScene();

      act(() => activateFullSceneTree(scene));
      render(<DashboardEditPaneSplitter dashboard={scene} />, { grafanaContext: { chrome } });

      const view = renderBreadcrumbActions(chrome);
      expect(view.getByTestId('dynamic-left-action')).toBeInTheDocument();
    });

    it('should not repeatedly update chrome when dashboard state is unchanged', async () => {
      const chrome = new AppChromeService();
      const updateSpy = jest.spyOn(chrome, 'update');
      const scene = buildViewModeScene();

      act(() => activateFullSceneTree(scene));
      render(<DashboardEditPaneSplitter dashboard={scene} />, { grafanaContext: { chrome } });

      expect(countBreadcrumbActionUpdates(updateSpy)).toBe(1);

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(countBreadcrumbActionUpdates(updateSpy)).toBe(1);
    });

    it('should re-update breadcrumb actions when dashboard meta.url becomes available', () => {
      const chrome = new AppChromeService();
      const updateSpy = jest.spyOn(chrome, 'update');
      const scene = buildViewModeScene({ withUrl: false });

      act(() => activateFullSceneTree(scene));
      render(<DashboardEditPaneSplitter dashboard={scene} />, { grafanaContext: { chrome } });

      expect(countBreadcrumbActionUpdates(updateSpy)).toBe(1);

      act(() => {
        scene.setState({ meta: { ...scene.state.meta, url: '/d/dash-1/test-dashboard' } });
      });

      expect(countBreadcrumbActionUpdates(updateSpy)).toBe(2);
    });

    it('should clear breadcrumb actions on unmount', () => {
      const chrome = new AppChromeService();
      const updateSpy = jest.spyOn(chrome, 'update');
      const scene = buildViewModeScene();

      act(() => activateFullSceneTree(scene));
      const view = render(<DashboardEditPaneSplitter dashboard={scene} />, { grafanaContext: { chrome } });

      view.unmount();

      expect(updateSpy).toHaveBeenLastCalledWith({ breadcrumbActions: undefined });
    });
  });

  it('should switch between custom and auto layout', async () => {
    const user = userEvent.setup();
    const scene = buildTestScene();

    render(<DashboardEditPaneSplitter dashboard={scene} />);

    await user.click(screen.getByTestId(selectors.pages.Dashboard.Sidebar.optionsButton));

    // switch to auto and confirm change
    await user.click(screen.getByLabelText('layout-selection-option-Auto'));
    let confirmButton = screen.getByTestId(selectors.pages.ConfirmModal.delete);
    await user.click(confirmButton);

    // check auto layout inputs are visible
    autoLayoutInputs.forEach((testId) => {
      expect(screen.queryByTestId(testId)).toBeInTheDocument();
    });
    expect(scene.state.body).toBeInstanceOf(AutoGridLayoutManager);

    // switch back to custom and confirm change
    await user.click(screen.getByLabelText('layout-selection-option-Custom'));
    confirmButton = screen.getByTestId(selectors.pages.ConfirmModal.delete);
    await user.click(confirmButton);

    // check that auto layout inputs are not visible in custom
    autoLayoutInputs.forEach((testId) => {
      expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
    });
  });
});

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

function buildViewModeScene(options?: { withUrl?: boolean }) {
  return new DashboardScene({
    uid: 'dash-1',
    title: 'Test Dashboard',
    $variables: new SceneVariableSet({ variables: [] }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    $data: new DashboardDataLayerSet({ annotationLayers: [] }),
    isEditing: false,
    meta: {
      canStar: true,
      canEdit: true,
      ...(options?.withUrl === false ? {} : { url: '/d/dash-1/test-dashboard' }),
    },
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [new DashboardGridItem({ body: new VizPanel({ key: 'panel-1', pluginId: 'text' }) })],
      }),
    }),
  });
}
