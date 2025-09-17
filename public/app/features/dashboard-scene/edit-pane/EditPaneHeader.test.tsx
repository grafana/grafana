import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';
import { SceneTimeRange } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { RowItem } from '../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../scene/layout-tabs/TabsLayoutManager';
import { DashboardInteractions } from '../utils/interactions';
import { activateFullSceneTree } from '../utils/test-utils';

import { DashboardEditPane } from './DashboardEditPane';
import { EditPaneHeader } from './EditPaneHeader';
import { ElementSelection } from './ElementSelection';

// Mock DashboardInteractions
jest.mock('../utils/interactions', () => ({
  DashboardInteractions: {
    trackRemoveRowClick: jest.fn(),
    trackRemoveTabClick: jest.fn(),
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

const buildTestScene = (scene: DashboardScene) => {
  activateFullSceneTree(scene);
  return scene;
};

describe('EditPaneHeader', () => {
  const mockEditPane = {
    state: { selection: null },
    clearSelection: jest.fn(),
  } as unknown as DashboardEditPane;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('tracking item deletion', () => {
    it('should call DashboardActions.trackDeleteRow when deleting a row', async () => {
      const user = userEvent.setup();
      const scene = buildTestScene(sceneWithRow);
      const row = (scene.state.body as RowsLayoutManager).state.rows[0];
      const elementSelection = new ElementSelection([['row-test', row.getRef()]]);
      const editableElement = elementSelection.createSelectionElement()!;

      render(<EditPaneHeader element={editableElement} editPane={mockEditPane} />);

      await user.click(screen.getByTestId(selectors.components.EditPaneHeader.deleteButton));
      expect(DashboardInteractions.trackRemoveRowClick).toHaveBeenCalled();
    });

    it('should call DashboardActions.trackDeleteTab when deleting a tab', async () => {
      const user = userEvent.setup();
      const scene = buildTestScene(sceneWithTab);
      const tab = (scene.state.body as TabsLayoutManager).state.tabs[0];
      const elementSelection = new ElementSelection([['tab-test', tab.getRef()]]);
      const editableElement = elementSelection.createSelectionElement()!;

      render(<EditPaneHeader element={editableElement} editPane={mockEditPane} />);

      await user.click(screen.getByTestId(selectors.components.EditPaneHeader.deleteButton));
      expect(DashboardInteractions.trackRemoveTabClick).toHaveBeenCalled();
    });
  });
});
