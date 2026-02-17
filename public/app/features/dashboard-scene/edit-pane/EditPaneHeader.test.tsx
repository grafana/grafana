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
import { EditableDashboardElement } from '../scene/types/EditableDashboardElement';
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

describe('EditPaneHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  describe('tracking item deletion', () => {
    it('should call DashboardInteractions.trackDeleteDashboardElement when deleting a row', async () => {
      const { row, mockEditPane } = setup('row');
      const elementSelection = new ElementSelection([['row-test', row!.getRef()]]);
      const editableElement = elementSelection.createSelectionElement()!;
      renderEditPaneHeader(editableElement, mockEditPane);

      const user = userEvent.setup();
      await user.click(screen.getByTestId(selectors.components.EditPaneHeader.deleteButton));

      expect(DashboardInteractions.trackDeleteDashboardElement).toHaveBeenCalledWith('Row');
    });

    it('should call DashboardInteractions.trackDeleteDashboardElement when deleting a tab', async () => {
      const { tab, mockEditPane } = setup('tab');
      const elementSelection = new ElementSelection([['tab-test', tab!.getRef()]]);
      const editableElement = elementSelection.createSelectionElement()!;
      renderEditPaneHeader(editableElement, mockEditPane);

      const user = userEvent.setup();
      await user.click(screen.getByTestId(selectors.components.EditPaneHeader.deleteButton));

      expect(DashboardInteractions.trackDeleteDashboardElement).toHaveBeenCalledWith('Tab');
    });
  });

  it('should call DashboardInteractions.trackDeleteDashboardElement when deleting a panel', async () => {
    const { panel, mockEditPane } = setup('panel');
    const elementSelection = new ElementSelection([['panel-test', panel!.getRef()]]);
    const editableElement = elementSelection.createSelectionElement()!;
    renderEditPaneHeader(editableElement, mockEditPane);

    const user = userEvent.setup();
    await user.click(screen.getByTestId(selectors.components.EditPaneHeader.deleteButton));

    expect(DashboardInteractions.trackDeleteDashboardElement).toHaveBeenCalledWith('Panel');
  });
});

function WrapSidebar({ children }: { children: React.ReactElement }) {
  const sidebarContext = useSidebar({});

  return <Sidebar contextValue={sidebarContext}>{children}</Sidebar>;
}

const renderEditPaneHeader = (editableElement: EditableDashboardElement, mockEditPane: DashboardEditPane) => {
  render(
    <WrapSidebar>
      <EditPaneHeader element={editableElement} editPane={mockEditPane} />
    </WrapSidebar>
  );
};

const setup = (
  layout: 'row' | 'tab' | 'panel'
): { row?: RowItem; tab?: TabItem; panel?: VizPanel; mockEditPane: DashboardEditPane } => {
  const mockEditPane = {
    state: { selection: null },
    clearSelection: jest.fn(),
  } as unknown as DashboardEditPane;

  switch (layout) {
    case 'row': {
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
      activateFullSceneTree(sceneWithRow);
      return { row: (sceneWithRow.state.body as RowsLayoutManager).state.rows[0], mockEditPane };
    }
    case 'tab': {
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
      activateFullSceneTree(sceneWithTab);
      return { tab: (sceneWithTab.state.body as TabsLayoutManager).state.tabs[0], mockEditPane };
    }
    default: {
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
      activateFullSceneTree(sceneWithPanel);
      return {
        panel: ((sceneWithPanel.state.body as DefaultGridLayoutManager).state.grid.state.children[0] as SceneGridItem)
          .state.body as VizPanel,
        mockEditPane,
      };
    }
  }
};
