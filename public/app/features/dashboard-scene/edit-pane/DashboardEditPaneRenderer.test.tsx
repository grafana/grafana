import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';
import { config, setPluginImportUtils } from '@grafana/runtime';
import { SceneGridLayout, SceneTimeRange, VizPanel } from '@grafana/scenes';

import { getPanelPlugin } from '../../../../../packages/grafana-data/test/helpers/pluginMocks';
import { DashboardScene } from '../scene/DashboardScene';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { DashboardInteractions } from '../utils/interactions';
import { activateFullSceneTree } from '../utils/test-utils';

import { DashboardEditPaneRenderer } from './DashboardEditPaneRenderer';

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

jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useLocation: () => ({
    pathname: '/dashboard/test',
    search: '',
    hash: '',
    state: null,
  }),
}));

export function buildTestScene() {
  const testScene = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    isEditing: true,
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [new DashboardGridItem({ body: new VizPanel({ key: 'panel-1', pluginId: 'text' }) })],
      }),
    }),
  });
  activateFullSceneTree(testScene);
  return testScene;
}

describe('DashboardEditPaneRenderer', () => {
  describe('outline interactions tracking', () => {
    it('should call DashboardInteractions.outlineClicked when clicking on dashboard outline', async () => {
      const user = userEvent.setup();
      const scene = buildTestScene();
      render(
        <DashboardEditPaneRenderer
          editPane={scene.state.editPane}
          isEditPaneCollapsed={false}
          onToggleCollapse={() => {}}
        />
      );
      const outlineButton = screen.getByTestId(selectors.components.PanelEditor.Outline.section);
      await user.click(outlineButton);

      expect(DashboardInteractions.dashboardOutlineClicked).toHaveBeenCalled();
    });
  });
});
