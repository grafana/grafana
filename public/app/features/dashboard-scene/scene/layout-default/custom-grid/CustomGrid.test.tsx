import { act } from '@testing-library/react';
import { type PointerEvent as ReactPointerEvent } from 'react';
import { render } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { logError, logMeasurement, setPluginImportUtils } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import {
  SceneGridLayout,
  SceneGridLayoutDragStartEvent,
  SceneGridRow,
  SceneTimeRange,
  VizPanel,
} from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { DashboardEditActionEvent, type DashboardEditActionEventPayload } from '../../../sidebar/events';
import { DashboardScene } from '../../DashboardScene';
import { AutoGridItem } from '../../layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../../layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../../layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../../layout-rows/RowItem';
import { RowsLayoutManager } from '../../layout-rows/RowsLayoutManager';
import { DASHBOARD_DROP_TARGET_KEY_ATTR, isDashboardDropTarget } from '../../types/DashboardDropTarget';
import { type DashboardLayoutManager } from '../../types/DashboardLayoutManager';
import { DashboardGridItem } from '../DashboardGridItem';
import { DefaultGridLayoutManager } from '../DefaultGridLayoutManager';

import { CUSTOM_GRID_RENDER_MEASUREMENT, shouldRenderCustomGrid } from './CustomGrid';
import { CustomGridRenderer } from './CustomGridRenderer';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  logError: jest.fn(),
  logMeasurement: jest.fn(),
  // New panels get the default data source, these tests have none
  getDataSourceInstanceSettings: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-use', () => ({
  ...jest.requireActual('react-use'),
  useMeasure: () => [jest.fn(), { width: 1200, height: 800, x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0 }],
}));

jest.mock('./CustomGridRenderer', () => {
  const actual = jest.requireActual('./CustomGridRenderer');
  return { ...actual, CustomGridRenderer: jest.fn(actual.CustomGridRenderer) };
});

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({ id: 'text' }, () => <div>Panel content</div>)),
  getPanelPluginFromCache: () => undefined,
});

const CUSTOM_GRID = '[data-custom-grid]';
const REACT_GRID_LAYOUT = '.react-grid-layout';

function gridItem(id: number, x: number, y: number) {
  return new DashboardGridItem({
    key: `grid-item-${id}`,
    x,
    y,
    width: 12,
    height: 8,
    body: new VizPanel({ key: `panel-${id}`, title: `Panel ${id}`, pluginId: 'text' }),
  });
}

function createManager(children = [gridItem(1, 0, 0), gridItem(2, 12, 0)]) {
  const grid = new SceneGridLayout({ children });
  return new DefaultGridLayoutManager({ grid });
}

async function renderManager(manager: DefaultGridLayoutManager, isEditing = true) {
  const scene = new DashboardScene({ title: 'Grid', $timeRange: new SceneTimeRange({}), body: manager, isEditing });
  const result = render(<manager.Component model={manager} />);
  // Let the panels finish loading their plugin
  await act(async () => {});
  return { ...result, scene };
}

afterEach(() => {
  setTestFlags({});
  jest.mocked(logError).mockClear();
  jest.mocked(logMeasurement).mockClear();
  jest.mocked(CustomGridRenderer).mockImplementation(jest.requireActual('./CustomGridRenderer').CustomGridRenderer);
});

describe('DefaultGridLayoutManager renderer', () => {
  it('renders the react-grid-layout grid while editing with the unified drag and drop flag off', async () => {
    setTestFlags({ [FlagKeys.GrafanaDashboardUnifiedDragAndDrop]: false });

    const { container } = await renderManager(createManager());

    expect(container.querySelector(REACT_GRID_LAYOUT)).toBeInTheDocument();
    expect(container.querySelector(CUSTOM_GRID)).not.toBeInTheDocument();
    expect(container.querySelector('[data-griditem-key="grid-item-2"]')).toHaveTextContent('Panel 2');
    expect(logMeasurement).not.toHaveBeenCalled();
  });

  describe('with the unified drag and drop flag on', () => {
    beforeEach(() => setTestFlags({ [FlagKeys.GrafanaDashboardUnifiedDragAndDrop]: true }));

    it('renders the new grid while editing', async () => {
      const { container } = await renderManager(createManager());

      expect(container.querySelector(CUSTOM_GRID)).toBeInTheDocument();
      expect(container.querySelector(REACT_GRID_LAYOUT)).not.toBeInTheDocument();
      expect(container.querySelector('[data-griditem-key="grid-item-2"]')).toHaveTextContent('Panel 2');
    });

    it('keeps the react-grid-layout grid in view mode', async () => {
      const { container } = await renderManager(createManager(), false);

      expect(container.querySelector(REACT_GRID_LAYOUT)).toBeInTheDocument();
      expect(container.querySelector(CUSTOM_GRID)).not.toBeInTheDocument();
      expect(logMeasurement).not.toHaveBeenCalled();
    });

    it('counts each grid rendered in an edit session once, so the rollout can tell the fallback rate', async () => {
      const manager = createManager();
      const { unmount } = await renderManager(manager);
      unmount();
      render(<manager.Component model={manager} />);
      await act(async () => {});

      expect(logMeasurement).toHaveBeenCalledTimes(1);
      expect(logMeasurement).toHaveBeenCalledWith(CUSTOM_GRID_RENDER_MEASUREMENT, { rendered: 1, fallback: 0 });
    });

    it('switches to the new grid when editing starts', async () => {
      const { container, scene } = await renderManager(createManager(), false);

      await act(async () => scene.setState({ isEditing: true }));

      expect(container.querySelector(CUSTOM_GRID)).toBeInTheDocument();
    });

    it('falls back to the react-grid-layout grid when the new grid throws, and reports it once without identifiers', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.mocked(CustomGridRenderer).mockImplementation(() => {
        throw new Error('Cannot render panel-1 of dashboard abc');
      });
      const manager = createManager();

      const { container, unmount } = await renderManager(manager);

      expect(container.querySelector(REACT_GRID_LAYOUT)).toBeInTheDocument();
      expect(container.querySelector('[data-griditem-key="grid-item-1"]')).toHaveTextContent('Panel 1');
      expect(logError).toHaveBeenCalledTimes(1);
      const [reported, context] = jest.mocked(logError).mock.calls[0];
      expect(reported.message).toBe('Custom grid failed to render, fell back to the react-grid-layout grid');
      expect(context).toEqual({ errorName: 'Error' });

      // The grid stays on the old renderer when it is rendered again, without another report
      unmount();
      const remounted = render(<manager.Component model={manager} />);
      await act(async () => {});
      expect(remounted.container.querySelector(REACT_GRID_LAYOUT)).toBeInTheDocument();
      expect(remounted.container.querySelector(CUSTOM_GRID)).not.toBeInTheDocument();
      expect(logError).toHaveBeenCalledTimes(1);
      // Counted as a render that fell back
      expect(logMeasurement).toHaveBeenCalledTimes(1);
      expect(logMeasurement).toHaveBeenCalledWith(CUSTOM_GRID_RENDER_MEASUREMENT, { rendered: 1, fallback: 1 });
      consoleError.mockRestore();
    });
  });
});

describe('shouldRenderCustomGrid', () => {
  it('is false with the unified drag and drop flag off', () => {
    setTestFlags({ [FlagKeys.GrafanaDashboardUnifiedDragAndDrop]: false });

    expect(shouldRenderCustomGrid(createManager().state.grid, true)).toBe(false);
  });

  describe('with the unified drag and drop flag on', () => {
    beforeEach(() => setTestFlags({ [FlagKeys.GrafanaDashboardUnifiedDragAndDrop]: true }));

    it('is true for an editing session, whatever its mode', () => {
      expect(shouldRenderCustomGrid(createManager().state.grid, true)).toBe(true);
    });

    it('is false outside of an editing session', () => {
      expect(shouldRenderCustomGrid(createManager().state.grid, false)).toBe(false);
    });

    it('is false for grids with rows', () => {
      const grid = new SceneGridLayout({ children: [new SceneGridRow({ key: 'row', y: 0, children: [] })] });

      expect(shouldRenderCustomGrid(grid, true)).toBe(false);
    });

    it('is false for grids that fit their panels to the screen', () => {
      const grid = new SceneGridLayout({ children: [gridItem(1, 0, 0)], UNSAFE_fitPanels: true });

      expect(shouldRenderCustomGrid(grid, true)).toBe(false);
    });

    it('is false without the dynamic dashboard layouts', () => {
      setTestFlags({ [FlagKeys.GrafanaDashboardUnifiedDragAndDrop]: true, [FlagKeys.DashboardNewLayouts]: false });

      expect(shouldRenderCustomGrid(createManager().state.grid, true)).toBe(false);
    });
  });
});

describe('DefaultGridLayoutManager drags', () => {
  const GRID_WIDTH = 1200;
  const originalElementsFromPoint = document.elementsFromPoint;
  let clientWidth: jest.SpyInstance;

  beforeEach(() => {
    // jsdom does not lay out, so the grid's container gets the width react-use reports for it
    clientWidth = jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(GRID_WIDTH);
  });

  afterEach(() => {
    clientWidth.mockRestore();
    document.elementsFromPoint = originalElementsFromPoint;
  });

  async function renderEditingManager() {
    const manager = createManager();
    const rendered = await renderManager(manager);
    // Editing makes the grid draggable after a short delay
    act(() => manager.state.grid.setState({ isDraggable: true, isResizable: true }));
    return { manager, ...rendered };
  }

  /** Presses a panel's drag handle, as the panel header does */
  function pressDragHandle(manager: DefaultGridLayoutManager, panelKey: string, clientX: number, clientY: number) {
    const panel = manager.getVizPanels().find((candidate) => candidate.state.key === panelKey)!;
    const handle = document.createElement('div');
    handle.className = manager.state.grid.getDragClass();
    // Only the fields the drag start reads
    const evt = { button: 0, clientX, clientY, target: handle } as unknown as ReactPointerEvent;
    act(() => panel.publishEvent(new SceneGridLayoutDragStartEvent({ evt, panel }), true));
    return { evt, gridItem: panel.parent };
  }

  function recordEdits(scene: DashboardScene) {
    const edits: DashboardEditActionEventPayload[] = [];
    scene.subscribeToEvent(DashboardEditActionEvent, ({ payload }) => {
      payload.perform();
      edits.push(payload);
    });
    return edits;
  }

  function placements(manager: DefaultGridLayoutManager) {
    return manager.state.grid.state.children.map(({ state: { key, x, y } }) => ({ key, x, y }));
  }

  it('is not a drop target and hands drags to the layout orchestrator as before with the flag off', async () => {
    setTestFlags({ [FlagKeys.GrafanaDashboardUnifiedDragAndDrop]: false });
    const { manager, scene } = await renderEditingManager();
    const startDraggingSync = jest.spyOn(scene.state.layoutOrchestrator!, 'startDraggingSync');

    const { evt, gridItem } = pressDragHandle(manager, 'panel-2', 620, 10);

    expect(isDashboardDropTarget(manager)).toBe(false);
    expect(startDraggingSync.mock.calls).toEqual([[evt, gridItem]]);
  });

  describe('with the unified drag and drop flag on', () => {
    beforeEach(() => setTestFlags({ [FlagKeys.GrafanaDashboardUnifiedDragAndDrop]: true }));

    it('is a drop target only while the new grid renders it', async () => {
      const { manager, scene } = await renderEditingManager();
      expect(isDashboardDropTarget(manager)).toBe(true);

      await act(async () => scene.setState({ isEditing: false }));

      expect(isDashboardDropTarget(manager)).toBe(false);
    });

    it('moves a panel dragged within the grid on drop, as one undoable edit', async () => {
      const { manager, scene, container } = await renderEditingManager();
      const edits = recordEdits(scene);
      const gridContainer = container.querySelector(`${CUSTOM_GRID} > div`)!;
      document.elementsFromPoint = () => [gridContainer];

      // Grab Panel 2 at its top-left corner and drop it below Panel 1
      pressDragHandle(manager, 'panel-2', 604, 0);
      expect(gridContainer).toHaveAttribute(DASHBOARD_DROP_TARGET_KEY_ATTR, manager.state.key);
      act(() => {
        document.body.dispatchEvent(new MouseEvent('pointermove', { clientX: 0, clientY: 8 * 38, buttons: 1 }));
      });
      act(() => {
        document.body.dispatchEvent(new MouseEvent('pointerup', { clientX: 0, clientY: 8 * 38 }));
      });

      expect(edits.map(({ meta }) => meta)).toEqual([{ actionId: 'panel.move', scope: 'custom-grid' }]);
      expect(placements(manager)).toEqual([
        { key: 'grid-item-1', x: 0, y: 0 },
        { key: 'grid-item-2', x: 0, y: 8 },
      ]);
      expect(scene.state.layoutOrchestrator!.isDragging()).toBe(false);

      act(() => edits[0].undo());
      expect(placements(manager)).toEqual([
        { key: 'grid-item-1', x: 0, y: 0 },
        { key: 'grid-item-2', x: 12, y: 0 },
      ]);
    });

    it('cancels the drag in the layout orchestrator too when Escape is pressed', async () => {
      const { manager, scene, container } = await renderEditingManager();
      const edits = recordEdits(scene);
      const gridContainer = container.querySelector(`${CUSTOM_GRID} > div`)!;
      document.elementsFromPoint = () => [gridContainer];
      pressDragHandle(manager, 'panel-2', 604, 0);
      act(() => {
        document.body.dispatchEvent(new MouseEvent('pointermove', { clientX: 0, clientY: 8 * 38, buttons: 1 }));
      });
      expect(manager.getCustomGridController().getInteraction()).toMatchObject({ isActive: true });

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });
      document.body.dispatchEvent(new MouseEvent('pointerup', { clientX: 0, clientY: 8 * 38 }));

      expect(scene.state.layoutOrchestrator!.isDragging()).toBe(false);
      expect(edits).toHaveLength(0);
      expect(placements(manager)).toEqual([
        { key: 'grid-item-1', x: 0, y: 0 },
        { key: 'grid-item-2', x: 12, y: 0 },
      ]);
    });
  });
  describe('drops from other layouts, with the flag on', () => {
    // 1200px wide grids at the top-left of the viewport: columns are 50.33px apart, rows 38px apart
    const COLUMN_PX = (GRID_WIDTH + 8) / 24;
    const ROW_PX = 38;

    beforeEach(() => setTestFlags({ [FlagKeys.GrafanaDashboardUnifiedDragAndDrop]: true }));

    /** A dashboard with one row per layout. Only the given custom grids are rendered, without their rows. */
    async function renderRows(layouts: DashboardLayoutManager[], rendered: DefaultGridLayoutManager[]) {
      const rows = layouts.map((layout, index) => new RowItem({ key: `row-${index}`, title: `Row ${index}`, layout }));
      const scene = new DashboardScene({
        title: 'Rows',
        $timeRange: new SceneTimeRange({}),
        body: new RowsLayoutManager({ rows }),
        isEditing: true,
      });
      const result = render(
        <>
          {rendered.map((manager) => (
            <manager.Component key={manager.state.key} model={manager} />
          ))}
        </>
      );
      await act(async () => {});
      act(() => rendered.forEach((manager) => manager.state.grid.setState({ isDraggable: true })));
      return { ...result, scene, rows, orchestrator: scene.state.layoutOrchestrator! };
    }

    function gridContainerOf(container: HTMLElement, manager: DefaultGridLayoutManager): Element {
      return container.querySelector(`${CUSTOM_GRID} > [${DASHBOARD_DROP_TARGET_KEY_ATTR}="${manager.state.key}"]`)!;
    }

    function pointer(type: 'pointermove' | 'pointerup', clientX: number, clientY: number) {
      act(() => {
        document.body.dispatchEvent(
          new MouseEvent(type, { clientX, clientY, buttons: type === 'pointermove' ? 1 : 0 })
        );
      });
    }

    function cells(manager: DefaultGridLayoutManager) {
      return manager.state.grid.state.children
        .map(({ state }) => ({
          panel: 'body' in state && state.body instanceof VizPanel ? state.body.state.key : undefined,
          x: state.x,
          y: state.y,
          width: state.width,
          height: state.height,
        }))
        .sort((a, b) => (a.panel ?? '').localeCompare(b.panel ?? ''));
    }

    const TWO_PANELS = [
      { panel: 'panel-1', x: 0, y: 0, width: 12, height: 8 },
      { panel: 'panel-2', x: 12, y: 0, width: 12, height: 8 },
    ];

    function autoGridItem(id: number) {
      return new AutoGridItem({
        key: `auto-grid-item-${id}`,
        body: new VizPanel({ key: `panel-${id}`, title: `Panel ${id}`, pluginId: 'text' }),
      });
    }

    it('previews a panel from an auto grid live, sized like it was shown, and drops it there with exact undo and redo', async () => {
      const autoGridLayout = new AutoGridLayout({ children: [autoGridItem(5), autoGridItem(6)] });
      const autoGrid = new AutoGridLayoutManager({ layout: autoGridLayout });
      const target = createManager();
      const { scene, orchestrator, container } = await renderRows([autoGrid, target], [target]);
      const edits = recordEdits(scene);
      const targetContainer = gridContainerOf(container, target);

      // The auto grid is as wide as the custom grid, the panel a third of it and 320px high
      const autoGridElement = document.createElement('div');
      autoGridElement.style.columnGap = '8px';
      (autoGridLayout.containerRef as { current: HTMLDivElement | null }).current = autoGridElement;
      const [dragged] = autoGridLayout.state.children;
      const itemElement = document.createElement('div');
      itemElement.getBoundingClientRect = () => ({ left: 0, top: 0, width: 397, height: 320 }) as DOMRect;
      (dragged.containerRef as { current: HTMLDivElement | null }).current = itemElement;

      // The auto grid drives the drag of its item itself
      orchestrator.startDraggingSync({ clientX: 10, clientY: 10 } as ReactPointerEvent, dragged, {
        onDrag: jest.fn(),
        onDragEnd: jest.fn(),
      });
      document.elementsFromPoint = () => [targetContainer];
      pointer('pointermove', 10, 8 * ROW_PX + 10);

      expect(target.getCustomGridController().getInteraction()?.preview).toContainEqual({
        i: 'panel-5',
        x: 0,
        y: 8,
        w: 8,
        h: 9,
      });

      // Leaving the grid shows its own layout again
      document.elementsFromPoint = () => [];
      pointer('pointermove', 10, 2000);
      expect(target.getCustomGridController().getInteraction()).toBeNull();

      document.elementsFromPoint = () => [targetContainer];
      pointer('pointermove', 10, 8 * ROW_PX + 10);
      pointer('pointerup', 10, 8 * ROW_PX + 10);
      // Let the dropped panel finish loading its plugin
      await act(async () => {});

      const dropped = [...TWO_PANELS, { panel: 'panel-5', x: 0, y: 8, width: 8, height: 9 }];
      // Moved straight away, so the panel never shows in its old place first
      expect(edits.map(({ meta }) => meta.actionId)).toEqual(['panel.move']);
      expect(cells(target)).toEqual(dropped);
      expect(autoGridLayout.state.children.map((child) => child.state.body.state.key)).toEqual(['panel-6']);
      expect(target.getCustomGridController().getInteraction()).toBeNull();

      await act(async () => edits[0].undo());
      expect(cells(target)).toEqual(TWO_PANELS);
      expect(autoGridLayout.state.children.map((child) => child.state.body.state.key)).toEqual(['panel-5', 'panel-6']);

      await act(async () => edits[0].perform());
      expect(cells(target)).toEqual(dropped);
      expect(autoGridLayout.state.children.map((child) => child.state.body.state.key)).toEqual(['panel-6']);
    });

    it('moves a panel from a custom grid in another row where it was previewed, closing the gap, with exact undo and redo', async () => {
      const source = createManager([gridItem(3, 0, 0), gridItem(4, 0, 8)]);
      const target = createManager();
      const { scene, container } = await renderRows([source, target], [source, target]);
      const edits = recordEdits(scene);
      const sourceContainer = gridContainerOf(container, source);
      const targetContainer = gridContainerOf(container, target);

      document.elementsFromPoint = () => [sourceContainer];
      pressDragHandle(source, 'panel-3', 10, 10);
      // Over the top-right cell of the other grid
      document.elementsFromPoint = () => [targetContainer];
      pointer('pointermove', 12 * COLUMN_PX + 10, 10);

      // The source closes the gap as soon as the panel left, the target makes room for it
      expect(source.getCustomGridController().getInteraction()?.preview).toEqual([
        { i: 'panel-4', x: 0, y: 0, w: 12, h: 8 },
      ]);
      expect(target.getCustomGridController().getInteraction()?.preview).toEqual(
        expect.arrayContaining([
          { i: 'panel-3', x: 12, y: 0, w: 12, h: 8 },
          { i: 'panel-2', x: 12, y: 8, w: 12, h: 8 },
        ])
      );

      pointer('pointerup', 12 * COLUMN_PX + 10, 10);
      await act(async () => {});

      const sourceAfter = [{ panel: 'panel-4', x: 0, y: 0, width: 12, height: 8 }];
      const targetAfter = [
        { panel: 'panel-1', x: 0, y: 0, width: 12, height: 8 },
        { panel: 'panel-2', x: 12, y: 8, width: 12, height: 8 },
        { panel: 'panel-3', x: 12, y: 0, width: 12, height: 8 },
      ];
      const sourceBefore = [
        { panel: 'panel-3', x: 0, y: 0, width: 12, height: 8 },
        { panel: 'panel-4', x: 0, y: 8, width: 12, height: 8 },
      ];
      expect(edits.map(({ meta }) => meta.actionId)).toEqual(['panel.move']);
      expect(cells(source)).toEqual(sourceAfter);
      expect(cells(target)).toEqual(targetAfter);

      await act(async () => edits[0].undo());
      expect(cells(source)).toEqual(sourceBefore);
      expect(cells(target)).toEqual(TWO_PANELS);

      await act(async () => edits[0].perform());
      expect(cells(source)).toEqual(sourceAfter);
      expect(cells(target)).toEqual(targetAfter);
    });

    it('moves a panel dropped on the header of its own row within the grid, instead of to the bottom', async () => {
      const manager = createManager();
      const { scene, rows, container } = await renderRows([manager], [manager]);
      const edits = recordEdits(scene);
      const gridContainer = gridContainerOf(container, manager);
      // The row's element wraps its header and the grid, like the row renderer does
      container.setAttribute(DASHBOARD_DROP_TARGET_KEY_ATTR, rows[0].state.key!);
      const rowHeader = document.createElement('div');
      container.prepend(rowHeader);

      document.elementsFromPoint = () => [gridContainer, container];
      pressDragHandle(manager, 'panel-2', 12 * COLUMN_PX + 10, 10);
      document.elementsFromPoint = () => [rowHeader, container];
      pointer('pointermove', 10, 5);
      pointer('pointerup', 10, 5);

      expect(edits.map(({ meta }) => meta)).toEqual([{ actionId: 'panel.move', scope: 'custom-grid' }]);
      expect(cells(manager)).toEqual([
        { panel: 'panel-1', x: 0, y: 8, width: 12, height: 8 },
        { panel: 'panel-2', x: 0, y: 0, width: 12, height: 8 },
      ]);
      expect(rows[0].state.isDropTarget).toBeFalsy();
    });

    it('adds a new panel from the Add pane where the grid previewed it, undoably', async () => {
      const target = createManager();
      const { scene, orchestrator, container } = await renderRows([target], [target]);
      const edits = recordEdits(scene);
      const targetContainer = gridContainerOf(container, target);

      // The drop is deferred to the next frame
      const requestAnimationFrame = jest
        .spyOn(window, 'requestAnimationFrame')
        .mockImplementation((callback: FrameRequestCallback) => {
          callback(0);
          return 0;
        });
      orchestrator.startDraggingNewPanel('newPanel');
      document.elementsFromPoint = () => [targetContainer];
      // A new 12 x 8 panel is held by the middle of its header: over the second column, below the panels
      pointer('pointermove', 12 * COLUMN_PX + GRID_WIDTH / 4, 16 * ROW_PX + 16);
      expect(target.getCustomGridController().getInteraction()).toMatchObject({ kind: 'drop' });

      pointer('pointerup', 12 * COLUMN_PX + GRID_WIDTH / 4, 16 * ROW_PX + 16);
      await act(async () => {});
      requestAnimationFrame.mockRestore();

      const added = [...TWO_PANELS, { panel: 'panel-3', x: 12, y: 8, width: 12, height: 8 }];
      expect(edits.map(({ meta }) => meta.actionId)).toEqual(['panel.add']);
      expect(cells(target)).toEqual(added);
      expect(target.getCustomGridController().getInteraction()).toBeNull();

      act(() => edits[0].undo());
      expect(cells(target)).toEqual(TWO_PANELS);
      act(() => edits[0].perform());
      expect(cells(target)).toEqual(added);
    });
  });
});
