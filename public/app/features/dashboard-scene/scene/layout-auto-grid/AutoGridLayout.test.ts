import { type PointerEvent as ReactPointerEvent } from 'react';

import { FlagKeys } from '@grafana/runtime/internal';
import { VizPanel } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { DashboardScene } from '../DashboardScene';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { AUTO_GRID_ITEM_DROP_TARGET_ATTR, DASHBOARD_DROP_TARGET_KEY_ATTR } from '../types/DashboardDropTarget';

import { AutoGridItem } from './AutoGridItem';
import { AutoGridLayout } from './AutoGridLayout';
import { AutoGridLayoutManager } from './AutoGridLayoutManager';
import { DRAGGED_ITEM_TOP } from './const';

// Grid A takes up the top left of the window, grid B is below it
const GRID_A_RECT = { left: 0, top: 0, right: 800, bottom: 400, width: 800, height: 400 };
const INSIDE_GRID_A = { clientX: 600, clientY: 200 };
// Over the left half of B1, so an item dropped there goes before it
const OVER_GRID_B = { clientX: 100, clientY: 600 };
const OUTSIDE_EVERY_LAYOUT = { clientX: 900, clientY: 200 };

const originalElementsFromPoint = document.elementsFromPoint;
let elementsUnderPointer: Element[] = [];
let deactivate: (() => void) | undefined;

beforeEach(() => {
  document.elementsFromPoint = () => elementsUnderPointer;
});

afterEach(() => {
  // Ends any drag a test left running, so its listeners don't leak into the next test
  document.body.dispatchEvent(new MouseEvent('pointerup'));
  deactivate?.();
  deactivate = undefined;
  document.elementsFromPoint = originalElementsFromPoint;
  elementsUnderPointer = [];
  setTestFlags({});
});

describe('AutoGridLayout drag', () => {
  describe('with the unified drag and drop flag on', () => {
    beforeEach(() => setTestFlags({ [FlagKeys.GrafanaDashboardUnifiedDragAndDrop]: true }));

    it('closes the gap while the dragged item is outside of the grid and reopens it at the item under the pointer when it comes back', () => {
      const { gridA, items } = setup();
      startDrag(gridA, items.A1);

      pointerOverGridItem(gridA, 'A2');
      movePointer(INSIDE_GRID_A);
      expect(titles(gridA.state.layout.state.draggedChildren)).toEqual(['A2', 'A1', 'A3']);
      expect(gridA.state.layout.state.isDraggedItemOutside).toBeFalsy();

      pointerOverGrid('grid-b');
      movePointer(OVER_GRID_B);
      expect(gridA.state.layout.state.isDraggedItemOutside).toBe(true);

      // A2 was the last item hovered before leaving, and still reopens the slot
      pointerOverGridItem(gridA, 'A2');
      movePointer(INSIDE_GRID_A);
      expect(gridA.state.layout.state.isDraggedItemOutside).toBe(false);
      expect(titles(gridA.state.layout.state.draggedChildren)).toEqual(['A1', 'A2', 'A3']);
    });

    it('cancels the drag when the item is released outside of every layout', () => {
      const { dashboard, gridA, items } = setup();
      startDrag(gridA, items.A1);
      pointerOverGridItem(gridA, 'A3');
      movePointer(INSIDE_GRID_A);

      pointerOverNothing();
      movePointer(OUTSIDE_EVERY_LAYOUT);
      release(OUTSIDE_EVERY_LAYOUT);

      expectDragEnded(dashboard, gridA);
      expect(titles(gridA.state.layout.state.children)).toEqual(['A1', 'A2', 'A3']);
      expect(dashboard.state.sidebar.state.undoStack).toHaveLength(0);
    });

    it('cancels the drag on Escape, and the release after it changes nothing', () => {
      const { dashboard, gridA, items } = setup();
      startDrag(gridA, items.A1);
      pointerOverGridItem(gridA, 'A3');
      movePointer(INSIDE_GRID_A);

      const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      document.body.dispatchEvent(escape);
      expect(escape.defaultPrevented).toBe(true);
      expectDragEnded(dashboard, gridA);

      release(INSIDE_GRID_A);

      expect(titles(gridA.state.layout.state.children)).toEqual(['A1', 'A2', 'A3']);
      expect(dashboard.state.sidebar.state.undoStack).toHaveLength(0);
    });

    it('cancels the drag when the item is released outside of the window', () => {
      const { dashboard, gridA, items } = setup();
      startDrag(gridA, items.A1);
      pointerOverGridItem(gridA, 'A3');
      movePointer(INSIDE_GRID_A);

      // Outside the window, the page body never sees the release
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: -50, clientY: 200 }));

      expectDragEnded(dashboard, gridA);
      expect(titles(gridA.state.layout.state.children)).toEqual(['A1', 'A2', 'A3']);
      expect(dashboard.state.sidebar.state.undoStack).toHaveLength(0);
    });

    it('cancels the drag when the pointer moves without a pressed button, after a release the page did not see', () => {
      const { dashboard, gridA, items } = setup();
      startDrag(gridA, items.A1);
      pointerOverGridItem(gridA, 'A3');
      movePointer(INSIDE_GRID_A);

      movePointer(INSIDE_GRID_A, 0);

      expectDragEnded(dashboard, gridA);
      expect(titles(gridA.state.layout.state.children)).toEqual(['A1', 'A2', 'A3']);
    });

    it('still commits a reorder when the item is released within its grid', () => {
      const { dashboard, gridA, items } = setup();
      startDrag(gridA, items.A1);
      pointerOverGridItem(gridA, 'A3');
      movePointer(INSIDE_GRID_A);

      release(INSIDE_GRID_A);

      expectDragEnded(dashboard, gridA);
      expect(titles(gridA.state.layout.state.children)).toEqual(['A2', 'A3', 'A1']);
      expect(dashboard.state.sidebar.state.undoStack).toHaveLength(1);
    });

    it('restores the exact order of both grids on undo of a drop into another grid, and repeats the drop on redo', () => {
      const { dashboard, gridA, gridB, items } = setup();
      startDrag(gridA, items.A2);
      // A reorder previewed before leaving the grid is not part of the drop
      pointerOverGridItem(gridA, 'A3');
      movePointer(INSIDE_GRID_A);
      pointerOverGridItem(gridB, 'B1');
      movePointer(OVER_GRID_B);
      expect(gridA.state.layout.state.isDraggedItemOutside).toBe(true);

      release(OVER_GRID_B);

      expectDragEnded(dashboard, gridA);
      const moved = { a: ['A1', 'A3'], b: ['A2', 'B1'] };
      expect(titles(gridA.state.layout.state.children)).toEqual(moved.a);
      expect(titles(gridB.state.layout.state.children)).toEqual(moved.b);
      expect(dashboard.state.sidebar.state.undoStack).toHaveLength(1);

      dashboard.state.sidebar.undoAction();
      expect(titles(gridA.state.layout.state.children)).toEqual(['A1', 'A2', 'A3']);
      expect(titles(gridB.state.layout.state.children)).toEqual(['B1']);

      dashboard.state.sidebar.redoAction();
      expect(titles(gridA.state.layout.state.children)).toEqual(moved.a);
      expect(titles(gridB.state.layout.state.children)).toEqual(moved.b);
    });

    it('lets the pointer through the floating item once the press became a drag, so the wheel scrolls the dashboard', () => {
      const { gridA, items } = setup();
      const cell = items.A1.containerRef.current!;
      startDrag(gridA, items.A1, { clientX: 100, clientY: 10 });
      pointerOverGridItem(gridA, 'A1');

      // A press that barely moves is still a click on the header, which selects the panel
      movePointer({ clientX: 101, clientY: 11 });
      expect(cell.style.pointerEvents).toBe('');

      movePointer({ clientX: 100, clientY: 30 });
      expect(cell.style.pointerEvents).toBe('none');

      release({ clientX: 100, clientY: 30 });
      expect(cell.style.pointerEvents).toBe('');
    });

    it('keeps the floating item under a resting pointer in the viewport when the grid moves on the page', () => {
      jest.useFakeTimers();
      try {
        const { gridA, items, containerA } = setup();
        startDrag(gridA, items.A1, { clientX: 100, clientY: 10 });
        pointerOverGrid('grid-b');
        movePointer(OVER_GRID_B);
        expect(containerA.style.getPropertyValue(DRAGGED_ITEM_TOP)).toBe('590px');

        // e.g. a layout above the grid previews the drop and grows
        containerA.getBoundingClientRect = () => ({ ...GRID_A_RECT, top: 100, bottom: 500 }) as DOMRect;
        jest.advanceTimersByTime(20);

        expect(containerA.style.getPropertyValue(DRAGGED_ITEM_TOP)).toBe('590px');
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('with the unified drag and drop flag off', () => {
    it('keeps the slot open while the dragged item is outside of the grid, and commits the reorder on a release outside of every layout', () => {
      const { dashboard, gridA, items } = setup();
      startDrag(gridA, items.A1);
      pointerOverGridItem(gridA, 'A3');
      movePointer(INSIDE_GRID_A);

      pointerOverNothing();
      movePointer(OUTSIDE_EVERY_LAYOUT);
      expect(gridA.state.layout.state.isDraggedItemOutside).toBeFalsy();

      release(OUTSIDE_EVERY_LAYOUT);

      expect(titles(gridA.state.layout.state.children)).toEqual(['A2', 'A3', 'A1']);
      expect(dashboard.state.sidebar.state.undoStack).toHaveLength(1);
    });

    it('does not cancel the drag on Escape', () => {
      const { dashboard, gridA, items } = setup();
      startDrag(gridA, items.A1);
      pointerOverGridItem(gridA, 'A3');
      movePointer(INSIDE_GRID_A);

      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(gridA.state.layout.state.draggingKey).toBe(items.A1.state.key);

      release(INSIDE_GRID_A);

      expect(titles(gridA.state.layout.state.children)).toEqual(['A2', 'A3', 'A1']);
      expect(dashboard.state.sidebar.state.undoStack).toHaveLength(1);
    });
  });
});

function setup() {
  const items = {
    A1: createItem('A1'),
    A2: createItem('A2'),
    A3: createItem('A3'),
    B1: createItem('B1'),
  };
  const gridA = new AutoGridLayoutManager({
    key: 'grid-a',
    layout: new AutoGridLayout({ key: 'layout-a', children: [items.A1, items.A2, items.A3], isDraggable: true }),
  });
  const gridB = new AutoGridLayoutManager({
    key: 'grid-b',
    layout: new AutoGridLayout({ key: 'layout-b', children: [items.B1], isDraggable: true }),
  });
  const dashboard = new DashboardScene({
    isEditing: true,
    body: new RowsLayoutManager({
      rows: [new RowItem({ title: 'Row A', layout: gridA }), new RowItem({ title: 'Row B', layout: gridB })],
    }),
  });
  const deactivateDashboard = dashboard.activate();
  // Records the edit actions, for undo and redo
  const deactivateSidebar = dashboard.state.sidebar.activate();
  deactivate = () => {
    deactivateSidebar();
    deactivateDashboard();
  };

  const containerA = document.createElement('div');
  containerA.getBoundingClientRect = () => GRID_A_RECT as DOMRect;
  setRef(gridA.state.layout.containerRef, containerA);
  setRef(gridB.state.layout.containerRef, document.createElement('div'));
  Object.values(items).forEach((item) => {
    const element = document.createElement('div');
    element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 320 }) as DOMRect;
    setRef(item.containerRef, element);
  });

  return { dashboard, gridA, gridB, items, containerA };
}

function createItem(title: string) {
  return new AutoGridItem({
    key: `item-${title}`,
    body: new VizPanel({ title, key: `panel-${title}`, pluginId: 'table' }),
  });
}

function titles(children: AutoGridItem[] | undefined) {
  return children?.map((child) => child.state.body.state.title);
}

function setRef<T>(ref: { current: T | null }, value: T) {
  ref.current = value;
}

function startDrag(
  grid: AutoGridLayoutManager,
  item: AutoGridItem,
  { clientX, clientY } = { clientX: 100, clientY: 10 }
) {
  const handle = document.createElement('div');
  handle.className = grid.state.layout.getDragClass();
  const evt = {
    target: handle,
    button: 0,
    clientX,
    clientY,
    pageX: clientX,
    pageY: clientY,
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
  } as unknown as ReactPointerEvent;
  grid.state.layout.getDragHooks().onDragStart?.(evt, item.state.body);
}

function pointerOverGridItem(grid: AutoGridLayoutManager, title: string) {
  const itemElement = document.createElement('div');
  itemElement.setAttribute(AUTO_GRID_ITEM_DROP_TARGET_ATTR, `item-${title}`);
  itemElement.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 320 }) as DOMRect;
  const gridElement = document.createElement('div');
  gridElement.setAttribute(DASHBOARD_DROP_TARGET_KEY_ATTR, grid.state.key!);
  elementsUnderPointer = [itemElement, gridElement];
}

function pointerOverGrid(gridKey: string) {
  const gridElement = document.createElement('div');
  gridElement.setAttribute(DASHBOARD_DROP_TARGET_KEY_ATTR, gridKey);
  elementsUnderPointer = [gridElement];
}

function pointerOverNothing() {
  elementsUnderPointer = [];
}

function movePointer({ clientX, clientY }: { clientX: number; clientY: number }, buttons = 1) {
  document.body.dispatchEvent(pointerEvent('pointermove', { clientX, clientY, buttons }));
}

function release({ clientX, clientY }: { clientX: number; clientY: number }) {
  document.body.dispatchEvent(pointerEvent('pointerup', { clientX, clientY, bubbles: true }));
}

// The page doesn't scroll in these tests, so page coordinates are client coordinates
function pointerEvent(type: string, init: MouseEventInit) {
  const evt = new MouseEvent(type, init);
  Object.defineProperties(evt, { pageX: { value: init.clientX }, pageY: { value: init.clientY } });
  return evt;
}

function expectDragEnded(dashboard: DashboardScene, grid: AutoGridLayoutManager) {
  expect(dashboard.state.layoutOrchestrator?.isDragging()).toBe(false);
  expect(grid.state.layout.state.draggingKey).toBeUndefined();
  expect(grid.state.layout.state.draggedChildren).toBeUndefined();
  expect(grid.state.layout.state.isDraggedItemOutside).toBeUndefined();
}
