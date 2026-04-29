import { screen, render, renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneTimeRange, VizPanel } from '@grafana/scenes';

import { DashboardInteractions } from '../../utils/interactions';
import { activateFullSceneTree } from '../../utils/test-utils';
import { DashboardScene } from '../DashboardScene';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { TabItem } from '../layout-tabs/TabItem';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';

import { CanvasGridAddActions, useNestingRestrictions } from './CanvasGridAddActions';

jest.mock('../../utils/interactions', () => ({
  DashboardInteractions: {
    trackAddPanelClick: jest.fn(),
    trackGroupRowClick: jest.fn(),
    trackGroupTabClick: jest.fn(),
    trackPastePanelClick: jest.fn(),
  },
}));

// mock getDefaultVizPanel
jest.mock('../../utils/utils', () => ({
  ...jest.requireActual('../../utils/utils'),
  getDefaultVizPanel: () => new VizPanel({ key: 'panel-1', pluginId: 'text' }),
}));

// mock addNew
jest.mock('./addNew', () => ({
  ...jest.requireActual('./addNew'),
  addNewRowTo: jest.fn(),
  addNewTabTo: jest.fn(),
}));

// mock useClipboardState
jest.mock('./useClipboardState', () => ({
  ...jest.requireActual('./useClipboardState'),
  useClipboardState: () => ({
    hasCopiedPanel: true,
  }),
}));

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

function buildTestScene(body?: DashboardScene['state']['body']) {
  const scene = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    isEditing: true,
    body:
      body ??
      new TabsLayoutManager({
        tabs: [
          new TabItem({
            title: 'test tab',
            layout: new RowsLayoutManager({
              rows: [
                new RowItem({
                  title: 'Test Title',
                  layout: new TabsLayoutManager({
                    tabs: [new TabItem({ title: 'Subtab' })],
                  }),
                }),
              ],
            }),
          }),
        ],
      }),
  });
  activateFullSceneTree(scene);
  return scene;
}

describe('CanvasGridAddActions', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('tracking scene actions', () => {
    it('should call DashboardInteractions.trackAddPanelClick when clicking on add panel button', async () => {
      const scene = buildTestScene();
      const layoutManager = scene.state.body;
      layoutManager.addPanel = jest.fn();
      const user = userEvent.setup();
      render(<CanvasGridAddActions layoutManager={layoutManager} />);

      await user.click(await screen.findByTestId(selectors.components.CanvasGridAddActions.addPanel));
      expect(DashboardInteractions.trackAddPanelClick).toHaveBeenCalled();
    });

    it('should call DashboardInteractions.trackGroupRowClick when clicking on group into row button', async () => {
      const scene = buildTestScene();
      const layoutManager = scene.state.body;
      const user = userEvent.setup();
      render(<CanvasGridAddActions layoutManager={layoutManager} />);
      await user.click(await screen.findByTestId(selectors.components.CanvasGridAddActions.groupPanels));

      await user.click(await screen.findByTestId(selectors.components.CanvasGridAddActions.addRow));
      expect(DashboardInteractions.trackGroupRowClick).toHaveBeenCalled();
    });

    it('should call DashboardInteractions.trackGroupTabClick when clicking on group into tab', async () => {
      const scene = buildTestScene();
      const layoutManager = scene.state.body;
      const user = userEvent.setup();
      render(<CanvasGridAddActions layoutManager={layoutManager} />);

      await user.click(await screen.findByTestId(selectors.components.CanvasGridAddActions.groupPanels));
      await user.click(await screen.findByTestId(selectors.components.CanvasGridAddActions.addTab));
      expect(DashboardInteractions.trackGroupTabClick).toHaveBeenCalled();
    });

    // Note: Ungroup functionality has been moved to TabsLayoutManagerRenderer and RowsLayoutManagerRenderer
    // Tests for ungroup tracking should be added to those components' test files

    it('should call DashboardInteractions.trackPastePanel when clicking on the paste panel button', async () => {
      const scene = buildTestScene();
      const layoutManager = scene.state.body;
      layoutManager.pastePanel = jest.fn();
      const user = userEvent.setup();
      render(<CanvasGridAddActions layoutManager={layoutManager} />);

      await user.click(await screen.findByTestId(selectors.components.CanvasGridAddActions.pastePanel));
      expect(DashboardInteractions.trackPastePanelClick).toHaveBeenCalled();
    });
  });

  describe('useNestingRestrictions', () => {
    it('should allow both grouping and tabs at the top level', () => {
      const { body: layoutManager } = buildTestScene(AutoGridLayoutManager.createEmpty()).state;

      const { result } = renderHook(() => useNestingRestrictions(layoutManager));

      expect(result.current).toEqual({ disableGrouping: false, disableTabs: false });
    });

    it('should allow both grouping and tabs when nested one level inside rows', () => {
      const innerLayout = AutoGridLayoutManager.createEmpty();
      buildTestScene(new RowsLayoutManager({ rows: [new RowItem({ layout: innerLayout })] }));

      const { result } = renderHook(() => useNestingRestrictions(innerLayout));

      expect(result.current).toEqual({ disableGrouping: false, disableTabs: false });
    });

    it('should disable tabs but allow grouping when nested one level inside tabs', () => {
      const innerLayout = AutoGridLayoutManager.createEmpty();
      buildTestScene(new TabsLayoutManager({ tabs: [new TabItem({ layout: innerLayout })] }));

      const { result } = renderHook(() => useNestingRestrictions(innerLayout));

      expect(result.current).toEqual({ disableGrouping: false, disableTabs: true });
    });

    it('should allow both grouping and tabs when nested two levels deep (rows > rows)', () => {
      const innerLayout = AutoGridLayoutManager.createEmpty();
      buildTestScene(
        new RowsLayoutManager({
          rows: [
            new RowItem({
              layout: new RowsLayoutManager({ rows: [new RowItem({ layout: innerLayout })] }),
            }),
          ],
        })
      );

      const { result } = renderHook(() => useNestingRestrictions(innerLayout));

      expect(result.current).toEqual({ disableGrouping: false, disableTabs: false });
    });

    it('should allow grouping but disable tabs when nested two levels deep (tabs > rows)', () => {
      const innerLayout = AutoGridLayoutManager.createEmpty();
      buildTestScene(
        new TabsLayoutManager({
          tabs: [
            new TabItem({
              layout: new RowsLayoutManager({ rows: [new RowItem({ layout: innerLayout })] }),
            }),
          ],
        })
      );

      const { result } = renderHook(() => useNestingRestrictions(innerLayout));

      expect(result.current).toEqual({ disableGrouping: false, disableTabs: true });
    });

    it('should allow grouping but disable tabs when nested two levels deep (rows > tabs)', () => {
      const innerLayout = AutoGridLayoutManager.createEmpty();
      buildTestScene(
        new RowsLayoutManager({
          rows: [
            new RowItem({
              layout: new TabsLayoutManager({ tabs: [new TabItem({ layout: innerLayout })] }),
            }),
          ],
        })
      );

      const { result } = renderHook(() => useNestingRestrictions(innerLayout));

      expect(result.current).toEqual({ disableGrouping: false, disableTabs: true });
    });

    it('should disable both grouping and tabs when nested three levels deep', () => {
      const innerLayout = AutoGridLayoutManager.createEmpty();
      buildTestScene(
        new RowsLayoutManager({
          rows: [
            new RowItem({
              layout: new RowsLayoutManager({
                rows: [
                  new RowItem({
                    layout: new RowsLayoutManager({ rows: [new RowItem({ layout: innerLayout })] }),
                  }),
                ],
              }),
            }),
          ],
        })
      );

      const { result } = renderHook(() => useNestingRestrictions(innerLayout));

      expect(result.current).toEqual({ disableGrouping: true, disableTabs: true });
    });
  });
});
