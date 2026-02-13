import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneGridItem, SceneGridLayout, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { Sidebar, useSidebar } from '@grafana/ui';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../scene/layout-tabs/TabsLayoutManager';
import { DashboardInteractions } from '../utils/interactions';
import { activateFullSceneTree } from '../utils/test-utils';

import { DashboardEditPane } from './DashboardEditPane';
import { EditPaneHeader } from './EditPaneHeader';
import { ElementSelection } from './ElementSelection';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

// Mock DashboardInteractions
jest.mock('../utils/interactions', () => ({
  DashboardInteractions: {
    trackDeleteDashboardElement: jest.fn(),
  },
}));

const sceneWithTab = new DashboardScene({
  $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
  isEditing: true,
  body: new TabsLayoutManager({
    tabs: [
      new TabItem({
        title: 'test tab',
      }),
    ],
  }),
});

const sceneWithRow = new DashboardScene({
  $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
  isEditing: true,
  body: new RowsLayoutManager({
    rows: [
      new RowItem({
        title: 'test row',
      }),
    ],
  }),
});

const panel = new VizPanel({
  key: 'panel-test',
  pluginId: 'text',
  title: 'panel-test',
});
const gridItem = new DashboardGridItem({ body: panel });
const sceneWithPanel = new DashboardScene({
  $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
  isEditing: true,
  body: new DefaultGridLayoutManager({
    grid: new SceneGridLayout({
      children: [gridItem],
    }),
  }),
});

const buildTestScene = (scene: DashboardScene) => {
  activateFullSceneTree(scene);
  return scene;
};

function WrapSidebar({ children }: { children: React.ReactElement }) {
  const sidebarContext = useSidebar({});

  return <Sidebar contextValue={sidebarContext}>{children}</Sidebar>;
}

describe('EditPaneHeader', () => {
  const mockEditPane = {
    state: { selection: null },
    clearSelection: jest.fn(),
  } as unknown as DashboardEditPane;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('tracking item deletion', () => {
    it('should call DashboardInteractions.trackDeleteDashboardElement when deleting a row', async () => {
      const user = userEvent.setup();
      const scene = buildTestScene(sceneWithRow);
      const row = (scene.state.body as RowsLayoutManager).state.rows[0];
      const elementSelection = new ElementSelection([['row-test', row.getRef()]]);
      const editableElement = elementSelection.createSelectionElement()!;

      render(
        <WrapSidebar>
          <EditPaneHeader element={editableElement} editPane={mockEditPane} />
        </WrapSidebar>
      );

      await user.click(screen.getByTestId(selectors.components.EditPaneHeader.deleteButton));
      expect(DashboardInteractions.trackDeleteDashboardElement).toHaveBeenCalledWith('row');
    });

    it('should call DashboardInteractions.trackDeleteDashboardElement when deleting a tab', async () => {
      const user = userEvent.setup();
      const scene = buildTestScene(sceneWithTab);
      const tab = (scene.state.body as TabsLayoutManager).state.tabs[0];
      const elementSelection = new ElementSelection([['tab-test', tab.getRef()]]);
      const editableElement = elementSelection.createSelectionElement()!;

      render(
        <WrapSidebar>
          <EditPaneHeader element={editableElement} editPane={mockEditPane} />
        </WrapSidebar>
      );

      await user.click(screen.getByTestId(selectors.components.EditPaneHeader.deleteButton));
      expect(DashboardInteractions.trackDeleteDashboardElement).toHaveBeenCalledWith('tab');
    });

    it('should call DashboardInteractions.trackDeleteDashboardElement when deleting a panel', async () => {
      const user = userEvent.setup();
      const scene = buildTestScene(sceneWithPanel);
      const panel = ((scene.state.body as DefaultGridLayoutManager).state.grid.state.children[0] as SceneGridItem).state
        .body as VizPanel;
      const elementSelection = new ElementSelection([['panel-test', panel.getRef()]]);
      const editableElement = elementSelection.createSelectionElement()!;

      render(
        <WrapSidebar>
          <EditPaneHeader element={editableElement} editPane={mockEditPane} />
        </WrapSidebar>
      );

      await user.click(screen.getByTestId(selectors.components.EditPaneHeader.deleteButton));
      expect(DashboardInteractions.trackDeleteDashboardElement).toHaveBeenCalledWith('panel');
    });
  });
});
