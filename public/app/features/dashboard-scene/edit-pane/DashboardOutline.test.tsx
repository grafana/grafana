import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';
import { config, setPluginImportUtils } from '@grafana/runtime';
import { SceneVariableSet, VizPanel } from '@grafana/scenes';
import { ElementSelectionContext } from '@grafana/ui';

import { getPanelPlugin } from '../../../../../packages/grafana-data/test/helpers/pluginMocks';
import { DashboardScene } from '../scene/DashboardScene';
import { AutoGridItem } from '../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../scene/layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../scene/layout-tabs/TabsLayoutManager';
import { DashboardInteractions } from '../utils/interactions';
import { activateFullSceneTree } from '../utils/test-utils';

import { DashboardOutline } from './DashboardOutline';

jest.mock('../utils/interactions', () => ({
  DashboardInteractions: {
    outlineItemClicked: jest.fn(),
  },
}));

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});
const testScene = new DashboardScene({
  title: 'Test Dashboard',
  $variables: new SceneVariableSet({ variables: [] }),
  body: new RowsLayoutManager({
    rows: [
      new RowItem({
        title: 'Row level 1',
        layout: new RowsLayoutManager({
          rows: [
            new RowItem({
              title: 'Row level 2',
              layout: new TabsLayoutManager({
                tabs: [
                  new TabItem({
                    title: 'Tab level 3 - A',
                    layout: new AutoGridLayoutManager({
                      layout: new AutoGridLayout({
                        children: [
                          new AutoGridItem({
                            body: new VizPanel({
                              title: 'Panel level 4 - A',
                            }),
                          }),
                        ],
                      }),
                    }),
                  }),
                  new TabItem({
                    title: 'Tab level 3 - B',
                    layout: new AutoGridLayoutManager({
                      layout: new AutoGridLayout({
                        children: [
                          new AutoGridItem({
                            body: new VizPanel({
                              title: 'Panel level 4 - A',
                            }),
                          }),
                        ],
                      }),
                    }),
                  }),
                ],
              }),
            }),
          ],
        }),
      }),
    ],
  }),
});

function buildTestScene() {
  activateFullSceneTree(testScene);
  return testScene;
}

describe('DashboardOutline', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('outline item interactions tracking', () => {
    it('should call DashboardInteractions.outlineItemClicked with correct parameters when clicking on items', async () => {
      const user = userEvent.setup();
      const scene = buildTestScene();

      // enable selection on the edit pane to activate real selection behavior
      scene.state.editPane.enableSelection();

      render(
        <ElementSelectionContext.Provider value={scene.state.editPane.state.selectionContext}>
          <DashboardOutline editPane={scene.state.editPane} />
        </ElementSelectionContext.Provider>
      );
      // select Row lvl 1
      await user.click(screen.getByTestId(selectors.components.PanelEditor.Outline.item('Row level 1')));
      expect(DashboardInteractions.outlineItemClicked).toHaveBeenNthCalledWith(1, {
        index: 1,
        depth: 1,
      });
      // click on caret to expand Row lvl 1
      await user.click(screen.getByTestId(selectors.components.PanelEditor.Outline.node('Row level 1')));

      // select Row lvl 2
      await user.click(screen.getByTestId(selectors.components.PanelEditor.Outline.item('Row level 2')));
      expect(DashboardInteractions.outlineItemClicked).toHaveBeenNthCalledWith(2, {
        index: 0,
        depth: 2,
      });

      // click on caret to expand Row lvl 2
      await user.click(screen.getByTestId(selectors.components.PanelEditor.Outline.node('Row level 2')));

      // select Tab lvl 3 - B
      await user.click(screen.getByTestId(selectors.components.PanelEditor.Outline.item('Tab level 3 - B')));
      expect(DashboardInteractions.outlineItemClicked).toHaveBeenNthCalledWith(3, {
        index: 1,
        depth: 3,
      });
    });
  });
});
