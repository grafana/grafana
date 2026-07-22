import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneVariableSet, VizPanel } from '@grafana/scenes';
import { ElementSelectionContext, Sidebar, useSidebar } from '@grafana/ui';

import { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../../scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { DashboardInteractions } from '../../utils/interactions';
import { activateFullSceneTree } from '../../utils/test-utils';

import { DashboardOutline } from './DashboardOutline';

jest.mock('../../utils/interactions', () => ({
  DashboardInteractions: {
    editSessionStarted: jest.fn(),
    outlineItemClicked: jest.fn(),
    dashboardEditDiscarded: jest.fn(),
  },
}));

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

function buildTestScene() {
  const testScene = new DashboardScene({
    title: 'Test Dashboard',
    $variables: new SceneVariableSet({ variables: [] }),
    $data: new DashboardDataLayerSet({ annotationLayers: [] }),
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
                                description: 'Shows important system metrics',
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

  activateFullSceneTree(testScene);
  return testScene;
}

function WrapSidebar({ children }: { children: React.ReactElement }) {
  const sidebarContext = useSidebar({});

  return <Sidebar contextValue={sidebarContext}>{children}</Sidebar>;
}

describe('DashboardOutline', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('collapsed state persistence', () => {
    it('should retain expanded/collapsed state when the pane is closed and reopened', async () => {
      const user = userEvent.setup();
      const scene = buildTestScene();
      const editPane = scene.state.editPane;
      const outlinePane = editPane.state.outlinePane!;

      scene.onEnterEditMode();
      editPane.enableSelection();
      editPane.openPane(outlinePane);

      const { unmount } = render(
        <ElementSelectionContext.Provider value={editPane.state.selectionContext}>
          <WrapSidebar>
            <outlinePane.Component model={outlinePane} />
          </WrapSidebar>
        </ElementSelectionContext.Provider>
      );

      await user.click(screen.getByTestId(selectors.components.PanelEditor.Outline.node('Row level 1')));
      expect(screen.getByTestId(selectors.components.PanelEditor.Outline.item('Row level 2'))).toBeInTheDocument();

      unmount();

      render(
        <ElementSelectionContext.Provider value={editPane.state.selectionContext}>
          <WrapSidebar>
            <outlinePane.Component model={outlinePane} />
          </WrapSidebar>
        </ElementSelectionContext.Provider>
      );

      expect(screen.getByTestId(selectors.components.PanelEditor.Outline.item('Row level 2'))).toBeInTheDocument();
    });

    it('should share collapsed state across clones', () => {
      const outline = new DashboardOutline();

      outline.setNodeCollapsed('node-1', false);
      outline.setNodeCollapsed('node-2', true);

      const cloned = outline.clone();

      expect(cloned.isNodeCollapsed('node-1', true)).toBe(false);
      expect(cloned.isNodeCollapsed('node-2', false)).toBe(true);

      cloned.setNodeCollapsed('node-3', false);
      expect(outline.isNodeCollapsed('node-3', true)).toBe(false);
    });

    it('should preserve collapsed state after entering and exiting edit mode', async () => {
      const user = userEvent.setup();
      const scene = buildTestScene();
      const editPane = scene.state.editPane;
      const outlinePane = editPane.state.outlinePane!;

      editPane.enableSelection();
      editPane.openPane(outlinePane);

      const { unmount } = render(
        <ElementSelectionContext.Provider value={editPane.state.selectionContext}>
          <WrapSidebar>
            <outlinePane.Component model={outlinePane} />
          </WrapSidebar>
        </ElementSelectionContext.Provider>
      );

      await user.click(screen.getByTestId(selectors.components.PanelEditor.Outline.node('Row level 1')));
      expect(screen.getByTestId(selectors.components.PanelEditor.Outline.item('Row level 2'))).toBeInTheDocument();

      unmount();

      scene.onEnterEditMode();
      scene.exitEditMode({ skipConfirm: true });

      const newOutlinePane = scene.state.editPane.state.outlinePane!;
      scene.state.editPane.enableSelection();
      scene.state.editPane.openPane(newOutlinePane);

      render(
        <ElementSelectionContext.Provider value={scene.state.editPane.state.selectionContext}>
          <WrapSidebar>
            <newOutlinePane.Component model={newOutlinePane} />
          </WrapSidebar>
        </ElementSelectionContext.Provider>
      );

      expect(screen.getByTestId(selectors.components.PanelEditor.Outline.item('Row level 2'))).toBeInTheDocument();
    });
  });

  describe('outline item interactions tracking', () => {
    it('should call DashboardInteractions.outlineItemClicked with correct parameters when clicking on items', async () => {
      const user = userEvent.setup();
      const scene = buildTestScene();
      const pane = new DashboardOutline({});

      // enable selection on the edit pane to activate real selection behavior
      scene.onEnterEditMode();
      scene.state.editPane.enableSelection();
      scene.state.editPane.openPane(pane);

      render(
        <ElementSelectionContext.Provider value={scene.state.editPane.state.selectionContext}>
          <WrapSidebar>
            <pane.Component model={pane} />
          </WrapSidebar>
        </ElementSelectionContext.Provider>
      );
      // select Row lvl 1 (index 3 because Variables is at 0, Annotations at 1, Links at 2)
      await user.click(screen.getByTestId(selectors.components.PanelEditor.Outline.item('Row level 1')));
      expect(DashboardInteractions.outlineItemClicked).toHaveBeenNthCalledWith(1, {
        index: 3,
        depth: 1,
        isEditing: true,
      });
      // click on caret to expand Row lvl 1
      await user.click(screen.getByTestId(selectors.components.PanelEditor.Outline.node('Row level 1')));

      // select Row lvl 2
      await user.click(screen.getByTestId(selectors.components.PanelEditor.Outline.item('Row level 2')));
      expect(DashboardInteractions.outlineItemClicked).toHaveBeenNthCalledWith(2, {
        index: 0,
        depth: 2,
        isEditing: true,
      });

      // click on caret to expand Row lvl 2
      await user.click(screen.getByTestId(selectors.components.PanelEditor.Outline.node('Row level 2')));

      // select Tab lvl 3 - B
      await user.click(screen.getByTestId(selectors.components.PanelEditor.Outline.item('Tab level 3 - B')));
      expect(DashboardInteractions.outlineItemClicked).toHaveBeenNthCalledWith(3, {
        index: 1,
        depth: 3,
        isEditing: true,
      });
    });

    it('should call DashboardInteractions.outlineItemClicked with correct parameters when not in edit mode', async () => {
      const user = userEvent.setup();
      const scene = buildTestScene();
      const pane = new DashboardOutline({});

      // enable selection on the edit pane to activate real selection behavior
      scene.state.editPane.enableSelection();
      scene.state.editPane.openPane(pane);

      render(
        <ElementSelectionContext.Provider value={scene.state.editPane.state.selectionContext}>
          <WrapSidebar>
            <pane.Component model={pane} />
          </WrapSidebar>
        </ElementSelectionContext.Provider>
      );
      // select Row lvl 1 (index 0 because variables and annotations aren't shown in view mode)
      await user.click(screen.getByTestId(selectors.components.PanelEditor.Outline.item('Row level 1')));
      expect(DashboardInteractions.outlineItemClicked).toHaveBeenNthCalledWith(1, {
        index: 0,
        depth: 1,
        isEditing: undefined,
      });
    });
  });

  describe('search', () => {
    it('shows hierarchical results with ancestor context for nested matches', async () => {
      const user = userEvent.setup();
      const scene = buildTestScene();
      const pane = new DashboardOutline({});

      scene.onEnterEditMode();
      scene.state.editPane.enableSelection();
      scene.state.editPane.openPane(pane);

      render(
        <ElementSelectionContext.Provider value={scene.state.editPane.state.selectionContext}>
          <WrapSidebar>
            <pane.Component model={pane} />
          </WrapSidebar>
        </ElementSelectionContext.Provider>
      );

      expect(
        screen.queryByTestId(selectors.components.PanelEditor.Outline.item('Tab level 3 - B'))
      ).not.toBeInTheDocument();

      await user.type(screen.getByTestId(selectors.pages.Dashboard.Sidebar.outline.searchInput), 'Tab level 3 - B');

      // Wait for debounced search to complete
      await waitFor(() => {
        // Matching item is shown
        expect(
          screen.getByTestId(selectors.components.PanelEditor.Outline.item('Tab level 3 - B'))
        ).toBeInTheDocument();
      });
      // Ancestors are shown for hierarchy context
      expect(screen.getByTestId(selectors.components.PanelEditor.Outline.item('Row level 1'))).toBeInTheDocument();
      expect(screen.getByTestId(selectors.components.PanelEditor.Outline.item('Row level 2'))).toBeInTheDocument();
      // Collapse toggles are hidden during search
      expect(
        screen.queryByTestId(selectors.components.PanelEditor.Outline.node('Row level 1'))
      ).not.toBeInTheDocument();
    });

    it('matches panel descriptions in search', async () => {
      const user = userEvent.setup();
      const scene = buildTestScene();
      const pane = new DashboardOutline({});

      scene.onEnterEditMode();
      scene.state.editPane.enableSelection();
      scene.state.editPane.openPane(pane);

      render(
        <ElementSelectionContext.Provider value={scene.state.editPane.state.selectionContext}>
          <WrapSidebar>
            <pane.Component model={pane} />
          </WrapSidebar>
        </ElementSelectionContext.Provider>
      );

      await user.type(
        screen.getByTestId(selectors.pages.Dashboard.Sidebar.outline.searchInput),
        'important system metrics'
      );

      await waitFor(() => {
        expect(
          screen.getByTestId(selectors.components.PanelEditor.Outline.item('Panel level 4 - A'))
        ).toBeInTheDocument();
      });
    });

    it('shows a no-results message and restores tree view when search is cleared', async () => {
      const user = userEvent.setup();
      const scene = buildTestScene();
      const pane = new DashboardOutline({});

      scene.onEnterEditMode();
      scene.state.editPane.enableSelection();
      scene.state.editPane.openPane(pane);

      render(
        <ElementSelectionContext.Provider value={scene.state.editPane.state.selectionContext}>
          <WrapSidebar>
            <pane.Component model={pane} />
          </WrapSidebar>
        </ElementSelectionContext.Provider>
      );

      const searchInput = screen.getByTestId(selectors.pages.Dashboard.Sidebar.outline.searchInput);

      await user.type(searchInput, 'does-not-exist');
      await waitFor(() => {
        expect(screen.getByText('No results found for your query')).toBeInTheDocument();
      });

      await user.clear(searchInput);
      await waitFor(() => {
        expect(screen.queryByText('No results found for your query')).not.toBeInTheDocument();
      });
      expect(screen.getByTestId(selectors.components.PanelEditor.Outline.item('Row level 1'))).toBeInTheDocument();
      expect(
        screen.queryByTestId(selectors.components.PanelEditor.Outline.item('Tab level 3 - B'))
      ).not.toBeInTheDocument();
    });

    it('retains search query when the pane is closed and reopened', async () => {
      const user = userEvent.setup();
      const scene = buildTestScene();
      const editPane = scene.state.editPane;
      const outlinePane = editPane.state.outlinePane!;

      scene.onEnterEditMode();
      editPane.enableSelection();
      editPane.openPane(outlinePane);

      const { unmount } = render(
        <ElementSelectionContext.Provider value={editPane.state.selectionContext}>
          <WrapSidebar>
            <outlinePane.Component model={outlinePane} />
          </WrapSidebar>
        </ElementSelectionContext.Provider>
      );

      const searchInput = screen.getByTestId(selectors.pages.Dashboard.Sidebar.outline.searchInput);
      await user.type(searchInput, 'Row level 1');
      expect(searchInput).toHaveValue('Row level 1');

      unmount();

      render(
        <ElementSelectionContext.Provider value={editPane.state.selectionContext}>
          <WrapSidebar>
            <outlinePane.Component model={outlinePane} />
          </WrapSidebar>
        </ElementSelectionContext.Provider>
      );

      expect(screen.getByTestId(selectors.pages.Dashboard.Sidebar.outline.searchInput)).toHaveValue('Row level 1');
    });

    it('preserves search query after entering and exiting edit mode', async () => {
      const user = userEvent.setup();
      const scene = buildTestScene();
      const editPane = scene.state.editPane;
      const outlinePane = editPane.state.outlinePane!;

      editPane.enableSelection();
      editPane.openPane(outlinePane);

      const { unmount } = render(
        <ElementSelectionContext.Provider value={editPane.state.selectionContext}>
          <WrapSidebar>
            <outlinePane.Component model={outlinePane} />
          </WrapSidebar>
        </ElementSelectionContext.Provider>
      );

      const searchInput = screen.getByTestId(selectors.pages.Dashboard.Sidebar.outline.searchInput);
      await user.type(searchInput, 'Row level 1');
      expect(searchInput).toHaveValue('Row level 1');

      unmount();

      scene.onEnterEditMode();
      scene.exitEditMode({ skipConfirm: true });

      const newOutlinePane = scene.state.editPane.state.outlinePane!;
      scene.state.editPane.enableSelection();
      scene.state.editPane.openPane(newOutlinePane);

      render(
        <ElementSelectionContext.Provider value={scene.state.editPane.state.selectionContext}>
          <WrapSidebar>
            <newOutlinePane.Component model={newOutlinePane} />
          </WrapSidebar>
        </ElementSelectionContext.Provider>
      );

      expect(screen.getByTestId(selectors.pages.Dashboard.Sidebar.outline.searchInput)).toHaveValue('Row level 1');
    });
  });
});
