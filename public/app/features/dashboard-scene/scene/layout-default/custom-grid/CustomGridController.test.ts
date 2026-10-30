import { selectors } from '@grafana/e2e-selectors';
import { logWarning } from '@grafana/runtime';
import { type SceneGridItemLike, SceneGridLayout, VizPanel } from '@grafana/scenes';

import { DashboardEditActionEvent, type DashboardEditActionEventPayload } from '../../../sidebar/events';
import { AutoGridItem } from '../../layout-auto-grid/AutoGridItem';
import { RowItem } from '../../layout-rows/RowItem';
import { DASHBOARD_DROP_TARGET_KEY_ATTR, type GridItemDragInfo } from '../../types/DashboardDropTarget';
import { DashboardGridItem } from '../DashboardGridItem';
import { DefaultGridLayoutManager } from '../DefaultGridLayoutManager';

import {
  CustomGridController,
  DRAG_LEFT_VAR,
  DRAG_TOP_VAR,
  NEW_PANEL_DROP_KEY,
  RESIZE_HEIGHT_VAR,
  RESIZE_WIDTH_VAR,
} from './CustomGridController';
import { type GridLayoutItem } from './gridMath';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  logWarning: jest.fn(),
}));

function gridItem(id: number, x?: number, y?: number, width?: number, height?: number) {
  return new DashboardGridItem({
    key: `grid-item-${id}`,
    x,
    y,
    width,
    height,
    body: new VizPanel({ key: `panel-${id}`, title: `Panel ${id}`, pluginId: 'timeseries' }),
  });
}

function setup(children: DashboardGridItem[]) {
  const grid = new SceneGridLayout({ children });
  const controller = new CustomGridController(grid);
  const listener = jest.fn();
  const unsubscribe = controller.subscribe(listener);
  return { grid, controller, listener, unsubscribe };
}

function placements(grid: SceneGridLayout) {
  return grid.state.children.map(({ state: { key, x, y, width, height } }) => ({ key, x, y, width, height }));
}

afterEach(() => jest.mocked(logWarning).mockClear());

describe('CustomGridController', () => {
  describe('getLayout', () => {
    it('is derived from the grid items, keyed by panel key and normalized like react-grid-layout does', () => {
      const { controller } = setup([gridItem(1, 0, 4, 12, 8), gridItem(2, 20, 4, 8, 8), gridItem(3, 0, 30, 24, 4)]);

      expect(controller.getLayout()).toEqual([
        { i: 'panel-1', x: 0, y: 0, w: 12, h: 8 },
        { i: 'panel-2', x: 16, y: 0, w: 8, h: 8 },
        { i: 'panel-3', x: 0, y: 8, w: 24, h: 4 },
      ]);
    });

    it('gives items without a position or size the defaults scenes renders them with', () => {
      const { controller } = setup([gridItem(1, undefined, undefined, undefined, undefined)]);

      expect(controller.getLayout()).toEqual([{ i: 'panel-1', x: 0, y: 0, w: 4, h: 4 }]);
    });

    it('returns the same layout until something changes, so React does not re-render for nothing', () => {
      const { controller, grid } = setup([gridItem(1, 0, 0, 12, 8)]);
      const layout = controller.getLayout();

      grid.forceRender();

      expect(controller.getLayout()).toBe(layout);
    });

    it('lays every item out at full width for narrow grids', () => {
      const { controller } = setup([gridItem(1, 0, 0, 12, 8), gridItem(2, 12, 0, 12, 4)]);

      expect(controller.getNarrowLayout()).toEqual([
        { i: 'panel-1', x: 0, y: 0, w: 24, h: 8 },
        { i: 'panel-2', x: 0, y: 8, w: 24, h: 4 },
      ]);
    });
  });

  // The assistant, Composer and undo change grid items directly; the rendered layout has to follow
  describe('programmatic changes', () => {
    it('follows a grid item that is moved or resized', () => {
      const { controller, grid, listener } = setup([gridItem(1, 0, 0, 12, 8), gridItem(2, 12, 0, 12, 8)]);

      grid.state.children[1].setState({ x: 0, y: 8, height: 4 });

      expect(listener).toHaveBeenCalled();
      expect(controller.getLayout()).toEqual([
        { i: 'panel-1', x: 0, y: 0, w: 12, h: 8 },
        { i: 'panel-2', x: 0, y: 8, w: 12, h: 4 },
      ]);
    });

    it('follows grid items that are added or removed', () => {
      const { controller, grid, listener } = setup([gridItem(1, 0, 0, 12, 8)]);
      const added = gridItem(2, 12, 0, 12, 8);

      grid.setState({ children: [...grid.state.children, added] });
      expect(listener).toHaveBeenCalledTimes(1);
      expect(controller.getLayout().map(({ i }) => i)).toEqual(['panel-1', 'panel-2']);

      grid.setState({ children: [added] });
      expect(listener).toHaveBeenCalledTimes(2);
      expect(controller.getLayout()).toEqual([{ i: 'panel-2', x: 12, y: 0, w: 12, h: 8 }]);
    });

    it('follows moves of a grid item that was added after subscribing', () => {
      const { controller, grid, listener } = setup([gridItem(1, 0, 0, 12, 8)]);
      const added = gridItem(2, 12, 0, 12, 8);
      grid.setState({ children: [...grid.state.children, added] });
      listener.mockClear();

      added.setState({ x: 0, y: 8 });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(controller.getLayout()[1]).toEqual({ i: 'panel-2', x: 0, y: 8, w: 12, h: 8 });
    });

    it('ignores grid item changes that do not affect the layout', () => {
      const { grid, listener } = setup([gridItem(1, 0, 0, 12, 8)]);

      grid.state.children[0].setState({ isDraggable: false });

      expect(listener).not.toHaveBeenCalled();
    });

    it('stops watching the scene once the last listener unsubscribes', () => {
      const { grid, listener, unsubscribe } = setup([gridItem(1, 0, 0, 12, 8)]);

      unsubscribe();
      grid.state.children[0].setState({ x: 12 });
      grid.setState({ children: [] });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('syncGridItems', () => {
    it('writes the normalized layout back onto the grid items and sorts them, like react-grid-layout', () => {
      const { controller, grid } = setup([
        gridItem(1, 0, 0, 12, 8),
        gridItem(2, 0, 4, 12, 8),
        gridItem(3, 12, 2, 12, 2),
      ]);

      controller.syncGridItems();

      expect(placements(grid)).toEqual([
        { key: 'grid-item-1', x: 0, y: 0, width: 12, height: 8 },
        { key: 'grid-item-3', x: 12, y: 0, width: 12, height: 2 },
        { key: 'grid-item-2', x: 0, y: 8, width: 12, height: 8 },
      ]);
      expect(logWarning).not.toHaveBeenCalled();
    });

    it('does not touch the scene when the grid items are already in place', () => {
      const { controller, grid } = setup([gridItem(1, 0, 0, 12, 8), gridItem(2, 12, 0, 12, 8)]);
      const children = grid.state.children;
      const itemListener = jest.fn();
      children[0].subscribeToState(itemListener);

      controller.syncGridItems();

      expect(grid.state.children).toBe(children);
      expect(itemListener).not.toHaveBeenCalled();
    });
  });

  describe('applyLayout', () => {
    it('moves the grid items of the given layout items and keeps the others in place', () => {
      const { controller, grid } = setup([gridItem(1, 0, 0, 12, 8), gridItem(2, 12, 0, 12, 8)]);

      controller.applyLayout([{ i: 'panel-2', x: 0, y: 8, w: 24, h: 4 }]);

      expect(placements(grid)).toEqual([
        { key: 'grid-item-1', x: 0, y: 0, width: 12, height: 8 },
        { key: 'grid-item-2', x: 0, y: 8, width: 24, height: 4 },
      ]);
      expect(logWarning).not.toHaveBeenCalled();
    });

    it('applies a corrected layout instead of an invalid one and reports it', () => {
      const { controller, grid } = setup([gridItem(1, 0, 0, 12, 8), gridItem(2, 12, 0, 12, 8)]);

      controller.applyLayout([{ i: 'panel-2', x: 6, y: 2, w: 24, h: 8 }]);

      expect(placements(grid)).toEqual([
        { key: 'grid-item-1', x: 0, y: 0, width: 12, height: 8 },
        { key: 'grid-item-2', x: 0, y: 8, width: 24, height: 8 },
      ]);
      expect(logWarning).toHaveBeenCalledWith(
        'Corrected an invalid custom grid layout',
        expect.objectContaining({ context: 'commit', overlapCount: '1', outOfBoundsCount: '1' })
      );
    });

    it('ignores layout items of panels that are not in the grid', () => {
      const { controller, grid } = setup([gridItem(1, 0, 0, 12, 8)]);

      controller.applyLayout([{ i: 'panel-9', x: 0, y: 0, w: 24, h: 8 }]);

      expect(placements(grid)).toEqual([{ key: 'grid-item-1', x: 0, y: 0, width: 12, height: 8 }]);
    });
  });

  describe('render failures', () => {
    it('remembers that the grid failed to render and tells only the first failure apart', () => {
      const { controller } = setup([]);

      expect(controller.hasRenderFailed()).toBe(false);
      expect(controller.markRenderFailed()).toBe(true);
      expect(controller.markRenderFailed()).toBe(false);
      expect(controller.hasRenderFailed()).toBe(true);
    });
  });
});

// 1200px wide grid at the top-left of the viewport: columns are 50.33px apart, rows 38px apart
const GRID_WIDTH = 1200;
const COLUMN_PX = (GRID_WIDTH + 8) / 24;
const ROW_PX = 38;
// The pointer grabs panels 10px in from their top-left corner
const GRAB: GridItemDragInfo = { offsetX: 10, offsetY: 10, width: 0, height: 0 };

interface InteractionSetupOptions {
  gridState?: Partial<SceneGridLayout['state']>;
  gridWidth?: number;
}

/**
 * A rendered grid: a container with one element per grid item, each with a drag handle, and an edit
 * listener that performs edit actions like the dashboard edit pane does
 */
function setupRenderedGrid(
  children: DashboardGridItem[],
  { gridState, gridWidth = GRID_WIDTH }: InteractionSetupOptions = {}
) {
  const grid = new SceneGridLayout({ children, isDraggable: true, isResizable: true, ...gridState });
  const controller = new CustomGridController(grid);
  const listener = jest.fn();
  controller.subscribe(listener);

  const container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { value: gridWidth });
  container.getBoundingClientRect = () => rect(0, 0, gridWidth, 2000);
  container.setAttribute(DASHBOARD_DROP_TARGET_KEY_ATTR, 'grid-manager');
  const handles = new Map<string, HTMLElement>();
  for (const child of children) {
    const element = document.createElement('div');
    element.setAttribute('data-griditem-key', child.state.key!);
    const handle = document.createElement('div');
    handle.className = grid.getDragClass();
    const cancel = document.createElement('button');
    cancel.className = grid.getDragClassCancel();
    handle.appendChild(cancel);
    element.appendChild(handle);
    container.appendChild(element);
    handles.set(child.state.key!, handle);
  }
  // The row the grid is in
  const section = document.createElement('div');
  section.setAttribute(DASHBOARD_DROP_TARGET_KEY_ATTR, 'own-row');
  section.appendChild(container);
  document.body.appendChild(section);
  controller.setContainer(container);

  // The pointer is over the grid unless a test moves it over another drop target
  const elementsUnderPointer: Element[] = [container];
  document.elementsFromPoint = jest.fn(() => elementsUnderPointer);

  const edits: DashboardEditActionEventPayload[] = [];
  grid.subscribeToEvent(DashboardEditActionEvent, ({ payload }) => {
    payload.perform();
    edits.push(payload);
  });

  const itemElement = (key: string) => container.querySelector<HTMLElement>(`[data-griditem-key="${key}"]`)!;
  const onCancel = jest.fn();

  /** Presses the pointer on the grid item's drag handle at the grab offset and starts the drag */
  const pressOnHandle = (item: SceneGridItemLike, target: Element = handles.get(item.state.key!)!) => {
    const { x = 0, y = 0 } = item.state;
    const press = { button: 0, clientX: x * COLUMN_PX + GRAB.offsetX, clientY: y * ROW_PX + GRAB.offsetY, target };
    if (controller.canStartDrag(press, item)) {
      controller.startDrag(item, press, GRAB, onCancel);
    }
    return press;
  };

  /** Moves the dragged item so its top-left corner is at the given cell */
  const dragToCell = (x: number, y: number) =>
    controller.onDrag({ clientX: x * COLUMN_PX + GRAB.offsetX, clientY: y * ROW_PX + GRAB.offsetY, buttons: 1 });

  const moveOverOtherDropTarget = () => {
    const other = document.createElement('div');
    other.setAttribute(DASHBOARD_DROP_TARGET_KEY_ATTR, 'other-row');
    elementsUnderPointer.splice(0, elementsUnderPointer.length, other, container.parentElement!);
  };

  const moveOverGrid = () => elementsUnderPointer.splice(0, elementsUnderPointer.length, container);

  /** Over the row around the grid, outside of the grid itself, e.g. on the row's header */
  const moveOverOwnSection = () => elementsUnderPointer.splice(0, elementsUnderPointer.length, section);

  /** Pointer position for an item from elsewhere whose top-left corner is at the given cell */
  const pointerAtCell = (x: number, y: number) => ({
    clientX: x * COLUMN_PX + GRAB.offsetX,
    clientY: y * ROW_PX + GRAB.offsetY,
    buttons: 1,
  });

  return {
    grid,
    controller,
    listener,
    container,
    edits,
    onCancel,
    itemElement,
    pressOnHandle,
    dragToCell,
    moveOverOtherDropTarget,
    moveOverGrid,
    moveOverOwnSection,
    pointerAtCell,
    handles,
  };
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    x: left,
    y: top,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  };
}

function dispatchPointer(type: string, init: MouseEventInit) {
  window.dispatchEvent(new MouseEvent(type, { bubbles: true, ...init }));
}

function layoutOf(grid: SceneGridLayout): GridLayoutItem[] {
  return grid.state.children
    .map(({ state }) => ({ key: state.key!, x: state.x!, y: state.y!, w: state.width!, h: state.height! }))
    .map(({ key, ...cell }) => ({ i: key.replace('grid-item', 'panel'), ...cell }))
    .sort((a, b) => a.i.localeCompare(b.i));
}

// Two panels side by side and one below the first
function threePanels() {
  return [gridItem(1, 0, 0, 12, 8), gridItem(2, 12, 0, 12, 8), gridItem(3, 0, 8, 12, 8)];
}

const THREE_PANELS: GridLayoutItem[] = [
  { i: 'panel-1', x: 0, y: 0, w: 12, h: 8 },
  { i: 'panel-2', x: 12, y: 0, w: 12, h: 8 },
  { i: 'panel-3', x: 0, y: 8, w: 12, h: 8 },
];

afterEach(() => {
  document.body.innerHTML = '';
  document.body.className = '';
});

describe('CustomGridController drag', () => {
  it('previews the move live while the grid items keep their positions', () => {
    const { grid, controller, listener, pressOnHandle, dragToCell, itemElement } = setupRenderedGrid(threePanels());
    const [, , third] = grid.state.children;
    pressOnHandle(third);
    listener.mockClear();

    dragToCell(0, 0);

    expect(controller.getInteraction()).toMatchObject({
      kind: 'drag',
      key: 'panel-3',
      isActive: true,
      isOutside: false,
    });
    expect(sortByKey(controller.getInteraction()!.preview)).toEqual([
      { i: 'panel-1', x: 0, y: 8, w: 12, h: 8 },
      { i: 'panel-2', x: 12, y: 0, w: 12, h: 8 },
      { i: 'panel-3', x: 0, y: 0, w: 12, h: 8 },
    ]);
    expect(listener).toHaveBeenCalled();
    expect(layoutOf(grid)).toEqual(THREE_PANELS);
    // The dragged item follows the pointer, wherever the cell it snaps to is
    expect(itemElement('grid-item-3').style.getPropertyValue(DRAG_LEFT_VAR)).toBe('0px');
    expect(itemElement('grid-item-3').style.getPropertyValue(DRAG_TOP_VAR)).toBe('0px');
  });

  it('positions the dragged panel in the viewport, so it stays under the pointer while the dashboard scrolls', () => {
    const { grid, controller, container, pressOnHandle, itemElement } = setupRenderedGrid(threePanels());
    pressOnHandle(grid.state.children[2]);
    // The dashboard is scrolled down by two rows
    container.getBoundingClientRect = () => rect(0, -2 * ROW_PX, GRID_WIDTH, 2000);

    // Over cell (12, 8) of the grid, which starts two rows above the viewport
    controller.onDrag({ clientX: 12 * COLUMN_PX + GRAB.offsetX, clientY: 6 * ROW_PX + GRAB.offsetY, buttons: 1 });

    expect(itemElement('grid-item-3').style.getPropertyValue(DRAG_LEFT_VAR)).toBe(`${12 * COLUMN_PX}px`);
    expect(itemElement('grid-item-3').style.getPropertyValue(DRAG_TOP_VAR)).toBe(`${6 * ROW_PX}px`);
    expect(controller.getInteraction()!.preview.find(({ i }) => i === 'panel-3')).toMatchObject({ x: 12, y: 8 });
  });

  it('does not lift the panel before the pointer moved a few pixels, so a click stays a click', () => {
    const { grid, controller, pressOnHandle } = setupRenderedGrid(threePanels());
    const press = pressOnHandle(grid.state.children[2]);

    controller.onDrag({ clientX: press.clientX + 2, clientY: press.clientY + 1, buttons: 1 });

    expect(controller.getInteraction()).toMatchObject({ isActive: false, preview: THREE_PANELS });
  });

  it('commits the drop as one undoable move that restores and reapplies every position exactly', () => {
    const { grid, controller, edits, pressOnHandle, dragToCell } = setupRenderedGrid(threePanels());
    const third = grid.state.children.find((child) => child.state.key === 'grid-item-3')!;
    pressOnHandle(third);
    dragToCell(0, 0);
    const preview = sortByKey(controller.getInteraction()!.preview);

    controller.commitDrag(third);
    controller.endDrag();

    expect(edits).toHaveLength(1);
    expect(edits[0].meta).toEqual({ actionId: 'panel.move', scope: 'custom-grid' });
    expect(layoutOf(grid)).toEqual(preview);
    // Children are kept in reading order
    expect(grid.state.children.map((child) => child.state.key)).toEqual(['grid-item-3', 'grid-item-2', 'grid-item-1']);
    expect(controller.getInteraction()).toBeNull();

    edits[0].undo();
    expect(layoutOf(grid)).toEqual(THREE_PANELS);

    edits[0].perform();
    expect(layoutOf(grid)).toEqual(preview);
  });

  it('does not add an undo step when the drop leaves the layout as it was', () => {
    const { grid, controller, edits, pressOnHandle, dragToCell } = setupRenderedGrid(threePanels());
    const third = grid.state.children[2];
    pressOnHandle(third);
    dragToCell(1, 0);
    dragToCell(0, 8);

    controller.commitDrag(third);

    expect(edits).toHaveLength(0);
    expect(layoutOf(grid)).toEqual(THREE_PANELS);
  });

  it('closes the gap while the item is over another drop target, and does not move it when dropped there', () => {
    const { grid, controller, edits, pressOnHandle, dragToCell, moveOverOtherDropTarget } =
      setupRenderedGrid(threePanels());
    const first = grid.state.children[0];
    pressOnHandle(first);
    dragToCell(0, 2);
    moveOverOtherDropTarget();
    dragToCell(0, 30);

    expect(controller.getInteraction()).toMatchObject({ isOutside: true });
    expect(sortByKey(controller.getInteraction()!.preview)).toEqual([
      { i: 'panel-2', x: 12, y: 0, w: 12, h: 8 },
      { i: 'panel-3', x: 0, y: 0, w: 12, h: 8 },
    ]);

    controller.commitDrag(first);

    expect(edits).toHaveLength(0);
    expect(layoutOf(grid)).toEqual(THREE_PANELS);
  });

  it('gives the positions before and after the item leaves, for a drop in another layout', () => {
    const { grid, controller, pressOnHandle, dragToCell, moveOverOtherDropTarget } = setupRenderedGrid(threePanels());
    pressOnHandle(grid.state.children[0]);
    dragToCell(0, 2);
    moveOverOtherDropTarget();
    dragToCell(0, 30);

    const snapshot = controller.getDragSourceSnapshot();

    expect(snapshot?.target).toBe(controller);
    expect(snapshot?.before).toEqual(THREE_PANELS);
    expect(snapshot?.after).toEqual(controller.getInteraction()!.preview);
  });

  it('inserts the item again where the pointer is once it is back over the grid', () => {
    const { grid, controller, pressOnHandle, dragToCell, moveOverOtherDropTarget, moveOverGrid } =
      setupRenderedGrid(threePanels());
    pressOnHandle(grid.state.children[0]);
    dragToCell(0, 1);
    moveOverOtherDropTarget();
    dragToCell(0, 30);
    moveOverGrid();

    dragToCell(12, 8);

    expect(controller.getInteraction()).toMatchObject({ isOutside: false });
    expect(sortByKey(controller.getInteraction()!.preview)).toEqual([
      { i: 'panel-1', x: 12, y: 8, w: 12, h: 8 },
      { i: 'panel-2', x: 12, y: 0, w: 12, h: 8 },
      { i: 'panel-3', x: 0, y: 0, w: 12, h: 8 },
    ]);
  });

  it('keeps the item in the grid while it is over the row around the grid, like the layout orchestrator does', () => {
    const { grid, controller, edits, pressOnHandle, dragToCell, moveOverOwnSection } = setupRenderedGrid(threePanels());
    const third = grid.state.children[2];
    pressOnHandle(third);
    moveOverOwnSection();

    // Above the grid, on the row's header
    dragToCell(0, -2);
    controller.commitDrag(third);

    expect(edits).toHaveLength(1);
    expect(layoutOf(grid)).toEqual([
      { i: 'panel-1', x: 0, y: 8, w: 12, h: 8 },
      { i: 'panel-2', x: 12, y: 0, w: 12, h: 8 },
      { i: 'panel-3', x: 0, y: 0, w: 12, h: 8 },
    ]);
  });

  describe('cancelling', () => {
    it('cancels on Escape and leaves every item where it was', () => {
      const { grid, controller, edits, onCancel, pressOnHandle, dragToCell } = setupRenderedGrid(threePanels());
      const third = grid.state.children[2];
      pressOnHandle(third);
      dragToCell(0, 0);

      const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      window.dispatchEvent(escape);
      controller.commitDrag(third);

      expect(escape.defaultPrevented).toBe(true);
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(controller.getInteraction()).toBeNull();
      expect(edits).toHaveLength(0);
      expect(layoutOf(grid)).toEqual(THREE_PANELS);
    });

    it('cancels when the pointer is released outside the window', () => {
      const { grid, controller, onCancel, pressOnHandle, dragToCell } = setupRenderedGrid(threePanels());
      pressOnHandle(grid.state.children[2]);
      dragToCell(0, 0);

      dispatchPointer('pointerup', { clientX: -50, clientY: 100 });

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(controller.getInteraction()).toBeNull();
      expect(layoutOf(grid)).toEqual(THREE_PANELS);
    });

    it('leaves a release inside the window to the layout orchestrator', () => {
      const { grid, controller, onCancel, pressOnHandle, dragToCell } = setupRenderedGrid(threePanels());
      pressOnHandle(grid.state.children[2]);
      dragToCell(0, 0);

      document.body.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 10, clientY: 10 }));

      expect(onCancel).not.toHaveBeenCalled();
      expect(controller.getInteraction()).toMatchObject({ isActive: true });
    });

    it('cancels when a pointer move shows the release was missed', () => {
      const { grid, controller, onCancel, pressOnHandle, dragToCell } = setupRenderedGrid(threePanels());
      pressOnHandle(grid.state.children[2]);
      dragToCell(0, 0);

      controller.onDrag({ clientX: 10, clientY: 10, buttons: 0 });

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(controller.getInteraction()).toBeNull();
    });

    it('stops listening once the drag ended', () => {
      const { grid, controller, onCancel, pressOnHandle, dragToCell } = setupRenderedGrid(threePanels());
      pressOnHandle(grid.state.children[2]);
      dragToCell(0, 0);
      controller.endDrag();

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  describe('which presses start a drag', () => {
    it('starts on the drag handle with the primary button', () => {
      const { grid, controller, pressOnHandle } = setupRenderedGrid(threePanels());

      pressOnHandle(grid.state.children[0]);

      expect(controller.getInteraction()).toMatchObject({ kind: 'drag', key: 'panel-1' });
    });

    it('does not start outside the drag handle or on a part of it that cancels drags', () => {
      const { grid, controller, handles, container } = setupRenderedGrid(threePanels());
      const item = grid.state.children[0];
      const press = { button: 0, clientX: 10, clientY: 10 };

      expect(controller.canStartDrag({ ...press, target: container }, item)).toBe(false);
      expect(controller.canStartDrag({ ...press, target: handles.get('grid-item-1')!.firstElementChild }, item)).toBe(
        false
      );
      expect(controller.canStartDrag({ ...press, button: 2, target: handles.get('grid-item-1')! }, item)).toBe(false);
    });

    it('does not start for items that are not draggable', () => {
      const notDraggable = gridItem(1, 0, 0, 12, 8);
      notDraggable.setState({ isDraggable: false });
      const { controller, handles } = setupRenderedGrid([notDraggable]);

      const press = { button: 0, clientX: 10, clientY: 10, target: handles.get('grid-item-1')! };
      expect(controller.canStartDrag(press, notDraggable)).toBe(false);
    });

    it('does not start for items of a repeated row clone', () => {
      const { grid, controller, handles } = setupRenderedGrid(threePanels());
      new RowItem({ key: 'row-clone', repeatSourceKey: 'row', layout: new DefaultGridLayoutManager({ grid }) });

      const press = { button: 0, clientX: 10, clientY: 10, target: handles.get('grid-item-1')! };
      expect(controller.canStartDrag(press, grid.state.children[0])).toBe(false);
    });

    it('does not start in a grid that is not draggable or too narrow for columns', () => {
      const notDraggable = setupRenderedGrid(threePanels(), { gridState: { isDraggable: false } });
      const press = (setup: ReturnType<typeof setupRenderedGrid>) => ({
        button: 0,
        clientX: 10,
        clientY: 10,
        target: setup.handles.get('grid-item-1')!,
      });
      expect(notDraggable.controller.canStartDrag(press(notDraggable), notDraggable.grid.state.children[0])).toBe(
        false
      );

      const narrow = setupRenderedGrid(threePanels(), { gridWidth: 768 });
      expect(narrow.controller.canStartDrag(press(narrow), narrow.grid.state.children[0])).toBe(false);
    });
  });
});

describe('CustomGridController drops from elsewhere', () => {
  // A panel of another custom grid, 6 x 4 cells
  const otherGridItem = () => gridItem(9, 0, 0, 6, 4);

  it('previews a panel from another custom grid live at the cell under the pointer, keeping its size', () => {
    const { grid, controller, listener, pointerAtCell } = setupRenderedGrid(threePanels());
    const item = otherGridItem();
    listener.mockClear();

    controller.previewExternalDrag(item, pointerAtCell(12, 0), GRAB);

    expect(controller.getInteraction()).toMatchObject({
      kind: 'drop',
      key: 'panel-9',
      isActive: true,
      isOutside: false,
    });
    expect(sortByKey(controller.getInteraction()!.preview)).toEqual([
      { i: 'panel-1', x: 0, y: 0, w: 12, h: 8 },
      { i: 'panel-2', x: 12, y: 4, w: 12, h: 8 },
      { i: 'panel-3', x: 0, y: 8, w: 12, h: 8 },
      { i: 'panel-9', x: 12, y: 0, w: 6, h: 4 },
    ]);
    expect(listener).toHaveBeenCalled();
    expect(layoutOf(grid)).toEqual(THREE_PANELS);

    // The preview follows the pointer
    controller.previewExternalDrag(item, pointerAtCell(0, 16), GRAB);

    expect(sortByKey(controller.getInteraction()!.preview)).toEqual([
      ...THREE_PANELS,
      { i: 'panel-9', x: 0, y: 16, w: 6, h: 4 },
    ]);
  });

  it('does not notify the renderer while the pointer stays in the same cell', () => {
    const { controller, listener, pointerAtCell } = setupRenderedGrid(threePanels());
    const item = otherGridItem();
    controller.previewExternalDrag(item, pointerAtCell(12, 0), GRAB);
    const interaction = controller.getInteraction();
    listener.mockClear();

    const { clientX, clientY } = pointerAtCell(12, 0);
    controller.previewExternalDrag(item, { clientX: clientX + 3, clientY: clientY + 2, buttons: 1 }, GRAB);

    expect(listener).not.toHaveBeenCalled();
    expect(controller.getInteraction()).toBe(interaction);
  });

  it('shows its own layout again once the panel left the grid', () => {
    const { grid, controller, pointerAtCell } = setupRenderedGrid(threePanels());
    controller.previewExternalDrag(otherGridItem(), pointerAtCell(12, 0), GRAB);

    controller.endExternalDrop();

    expect(controller.getInteraction()).toBeNull();
    expect(controller.getExternalDropSnapshot()).toBeNull();
    expect(layoutOf(grid)).toEqual(THREE_PANELS);
  });

  it('sizes a panel from an auto grid by its share of the auto grid row and its height in grid rows', () => {
    const { controller, pointerAtCell } = setupRenderedGrid(threePanels());
    const autoGridItem = new AutoGridItem({
      key: 'auto-grid-item-9',
      body: new VizPanel({ key: 'panel-9', title: 'Panel 9', pluginId: 'timeseries' }),
    });
    // A third of a 1208px auto grid with 8px gaps, 320px high
    const info: GridItemDragInfo = { ...GRAB, width: 397, height: 320, autoGrid: { width: 1208, columnGap: 8 } };

    controller.previewExternalDrag(autoGridItem, pointerAtCell(0, 16), info);

    expect(controller.getInteraction()!.preview).toContainEqual({ i: 'panel-9', x: 0, y: 16, w: 8, h: 9 });
  });

  it('gives the positions before and after the drop, to land the panel where it was previewed and undo exactly', () => {
    const { controller, pointerAtCell } = setupRenderedGrid(threePanels());
    controller.previewExternalDrag(otherGridItem(), pointerAtCell(12, 0), GRAB);

    const snapshot = controller.getExternalDropSnapshot();

    expect(snapshot?.target).toBe(controller);
    expect(snapshot?.before).toEqual(THREE_PANELS);
    expect(snapshot?.after).toEqual(controller.getInteraction()!.preview);
  });

  it('does not preview drops in a grid too narrow for columns', () => {
    const { controller, pointerAtCell } = setupRenderedGrid(threePanels(), { gridWidth: 768 });

    controller.previewExternalDrag(otherGridItem(), pointerAtCell(12, 0), GRAB);

    expect(controller.getInteraction()).toBeNull();
    expect(controller.getExternalDropSnapshot()).toBeNull();
  });

  it('stops previewing when the grid is unmounted', () => {
    const { controller, pointerAtCell } = setupRenderedGrid(threePanels());
    controller.previewExternalDrag(otherGridItem(), pointerAtCell(12, 0), GRAB);

    controller.setContainer(null);

    expect(controller.getInteraction()).toBeNull();
  });

  it('previews a new panel held by the middle of its header, and gives its drop with the key it gets', () => {
    const { controller } = setupRenderedGrid(threePanels());
    // A 12 x 8 panel is 600px wide, so held 300px in from its left edge
    controller.previewNewPanelDrag(
      { clientX: 12 * COLUMN_PX + 300, clientY: 16 * ROW_PX + 16, buttons: 1 },
      { w: 12, h: 8 }
    );

    expect(controller.getInteraction()).toMatchObject({ kind: 'drop', key: NEW_PANEL_DROP_KEY });
    expect(controller.getExternalDropSnapshot()).toBeNull();
    const snapshot = controller.getNewPanelDropSnapshot('panel-10');
    expect(snapshot?.before).toEqual(THREE_PANELS);
    expect(snapshot?.after).toContainEqual({ i: 'panel-10', x: 12, y: 8, w: 12, h: 8 });
    expect(snapshot?.after.map(({ i }) => i)).not.toContain(NEW_PANEL_DROP_KEY);
  });
});

describe('CustomGridController resize', () => {
  function startResize(setup: ReturnType<typeof setupRenderedGrid>, key: string, clientX = 500, clientY = 300) {
    const item = setup.grid.state.children.find((child) => child.state.key === key)!;
    const evt = {
      button: 0,
      clientX,
      clientY,
      target: setup.container,
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    };
    setup.controller.startResize(evt, item);
    return evt;
  }

  it('previews the new size live, pushing the items it now overlaps down', () => {
    const setup = setupRenderedGrid(threePanels());
    const press = startResize(setup, 'grid-item-1');

    dispatchPointer('pointermove', {
      clientX: press.clientX + 2 * COLUMN_PX,
      clientY: press.clientY + 4 * ROW_PX,
      buttons: 1,
    });

    expect(press.preventDefault).toHaveBeenCalled();
    expect(setup.controller.getInteraction()).toMatchObject({ kind: 'resize', key: 'panel-1', isActive: true });
    expect(sortByKey(setup.controller.getInteraction()!.preview)).toEqual([
      { i: 'panel-1', x: 0, y: 0, w: 14, h: 12 },
      { i: 'panel-2', x: 12, y: 12, w: 12, h: 8 },
      { i: 'panel-3', x: 0, y: 12, w: 12, h: 8 },
    ]);
    expect(layoutOf(setup.grid)).toEqual(THREE_PANELS);
  });

  it('commits the release as one undoable resize that restores and reapplies every position exactly', () => {
    const setup = setupRenderedGrid(threePanels());
    const press = startResize(setup, 'grid-item-1');
    dispatchPointer('pointermove', {
      clientX: press.clientX + 2 * COLUMN_PX,
      clientY: press.clientY + 4 * ROW_PX,
      buttons: 1,
    });
    const preview = sortByKey(setup.controller.getInteraction()!.preview);

    dispatchPointer('pointerup', { clientX: press.clientX + 2 * COLUMN_PX, clientY: press.clientY + 4 * ROW_PX });

    expect(setup.edits).toHaveLength(1);
    expect(setup.edits[0].meta).toEqual({ actionId: 'panel.resize', scope: 'custom-grid' });
    expect(setup.edits[0].description).toBe('Resize panel');
    expect(layoutOf(setup.grid)).toEqual(preview);
    expect(setup.controller.getInteraction()).toBeNull();

    setup.edits[0].undo();
    expect(layoutOf(setup.grid)).toEqual(THREE_PANELS);

    setup.edits[0].perform();
    expect(layoutOf(setup.grid)).toEqual(preview);
  });

  it('scrolls near the bottom of the dashboard and keeps the corner under the resting pointer as the grid scrolls', () => {
    const frames: FrameRequestCallback[] = [];
    jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => frames.push(callback));
    const body = document.createElement('div');
    body.setAttribute('data-testid', selectors.components.DashboardSidebarSplitter.bodyContainer);
    let scrollTop = 0;
    Object.defineProperties(body, {
      clientHeight: { value: 600 },
      scrollHeight: { value: 3000 },
      scrollTop: { get: () => scrollTop, set: (value: number) => (scrollTop = value) },
    });
    body.getBoundingClientRect = () => rect(0, 0, GRID_WIDTH, 600);
    document.body.appendChild(body);
    const setup = setupRenderedGrid(threePanels());
    setup.container.getBoundingClientRect = () => rect(0, -scrollTop, GRID_WIDTH, 2000);
    const press = startResize(setup, 'grid-item-1', 500, 300);
    const startHeight = 8 * ROW_PX - 8;

    try {
      dispatchPointer('pointermove', { clientX: 500, clientY: 595, buttons: 1 });
      expect(setup.itemElement('grid-item-1').style.getPropertyValue(RESIZE_HEIGHT_VAR)).toBe(`${startHeight + 295}px`);

      frames.shift()!(0);
      expect(scrollTop).toBeGreaterThan(0);
      expect(setup.itemElement('grid-item-1').style.getPropertyValue(RESIZE_HEIGHT_VAR)).toBe(
        `${startHeight + 295 + scrollTop}px`
      );

      dispatchPointer('pointerup', { clientX: 500, clientY: 595 });
      expect(setup.controller.getInteraction()).toBeNull();
      expect(press.preventDefault).toHaveBeenCalled();
    } finally {
      jest.restoreAllMocks();
      body.remove();
    }
  });

  it('keeps items at least one cell big and no wider than the grid', () => {
    const setup = setupRenderedGrid(threePanels());
    const press = startResize(setup, 'grid-item-2');

    dispatchPointer('pointermove', { clientX: press.clientX + 2000, clientY: press.clientY - 2000, buttons: 1 });
    expect(setup.controller.getInteraction()!.preview.find(({ i }) => i === 'panel-2')).toMatchObject({ w: 12, h: 1 });
    expect(setup.itemElement('grid-item-2').style.getPropertyValue(RESIZE_WIDTH_VAR)).toBe('596px');

    dispatchPointer('pointermove', { clientX: press.clientX - 2000, clientY: press.clientY, buttons: 1 });
    expect(setup.controller.getInteraction()!.preview.find(({ i }) => i === 'panel-2')).toMatchObject({ w: 1 });
  });

  it('cancels on Escape and leaves every item where it was', () => {
    const setup = setupRenderedGrid(threePanels());
    const press = startResize(setup, 'grid-item-1');
    dispatchPointer('pointermove', { clientX: press.clientX + 200, clientY: press.clientY + 200, buttons: 1 });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    dispatchPointer('pointerup', { clientX: press.clientX + 200, clientY: press.clientY + 200 });

    expect(setup.controller.getInteraction()).toBeNull();
    expect(setup.edits).toHaveLength(0);
    expect(layoutOf(setup.grid)).toEqual(THREE_PANELS);
  });

  it('does not add an undo step when the size did not change', () => {
    const setup = setupRenderedGrid(threePanels());
    const press = startResize(setup, 'grid-item-1');
    dispatchPointer('pointermove', { clientX: press.clientX + 5, clientY: press.clientY + 5, buttons: 1 });

    dispatchPointer('pointerup', { clientX: press.clientX + 5, clientY: press.clientY + 5 });

    expect(setup.edits).toHaveLength(0);
  });
});

function sortByKey(layout: readonly GridLayoutItem[]): GridLayoutItem[] {
  return [...layout].sort((a, b) => a.i.localeCompare(b.i));
}
