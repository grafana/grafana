import { act, fireEvent } from '@testing-library/react';
import { render } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { LazyLoader, SceneDataNode, SceneGridLayout, SceneTimeRange, VizPanel } from '@grafana/scenes';

import { DashboardEditActionEvent } from '../../../sidebar/events';
import { DashboardScene } from '../../DashboardScene';
import { DASHBOARD_DROP_TARGET_KEY_ATTR } from '../../types/DashboardDropTarget';
import { DashboardGridItem } from '../DashboardGridItem';
import { DefaultGridLayoutManager } from '../DefaultGridLayoutManager';

import { DRAG_LEFT_VAR, DRAG_TOP_VAR, RESIZE_HEIGHT_VAR, RESIZE_WIDTH_VAR } from './CustomGridController';
import { CustomGridRenderer } from './CustomGridRenderer';
import { containerHeightPx, pixelRectFor } from './gridMath';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({ id: 'text' }, () => <div>Panel content</div>)),
  getPanelPluginFromCache: () => undefined,
});

const GRID_WIDTH = 1200;
let mockGridWidth = GRID_WIDTH;

jest.mock('react-use', () => ({
  ...jest.requireActual('react-use'),
  useMeasure: () => [
    jest.fn(),
    { width: mockGridWidth, height: 800, x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0 },
  ],
}));

function gridItem(id: number, x: number, y: number, width: number, height: number) {
  return new DashboardGridItem({
    key: `grid-item-${id}`,
    x,
    y,
    width,
    height,
    body: new VizPanel({ key: `panel-${id}`, title: `Panel ${id}`, pluginId: 'text' }),
  });
}

async function setup(
  children: DashboardGridItem[],
  gridState: Partial<SceneGridLayout['state']> = {},
  { isEditing = true, preload = false } = {}
) {
  const grid = new SceneGridLayout({ children, ...gridState });
  const manager = new DefaultGridLayoutManager({ grid });
  new DashboardScene({ title: 'Custom grid', $timeRange: new SceneTimeRange({}), body: manager, isEditing, preload });
  const controller = manager.getCustomGridController();
  const renderGrid = (editing: boolean) => (
    <CustomGridRenderer grid={grid} controller={controller} isEditing={editing} dropTargetKey="grid-manager" />
  );
  const { container, rerender } = render(renderGrid(isEditing));
  // Let the panels finish loading their plugin
  await act(async () => {});
  return { grid, controller, container, setEditing: (editing: boolean) => rerender(renderGrid(editing)) };
}

/** Records whether the panel's data was told it is in view, which is when a query runner runs its queries */
class InViewRecorder extends SceneDataNode {
  public inView: boolean[] = [];

  public isInViewChanged(isInView: boolean) {
    this.inView.push(isInView);
  }
}

function panelWithData(id: number, y: number) {
  const data = new InViewRecorder({});
  const item = new DashboardGridItem({
    key: `grid-item-${id}`,
    x: 0,
    y,
    width: 24,
    height: 8,
    body: new VizPanel({ key: `panel-${id}`, title: `Panel ${id}`, pluginId: 'text', $data: data }),
  });
  return { item, data };
}

function getItemElement(container: HTMLElement, key: string): HTMLElement {
  const element = container.querySelector<HTMLElement>(`[data-griditem-key="${key}"]`);
  if (!element) {
    throw new Error(`No element for grid item ${key}`);
  }
  return element;
}

function expectAt(element: HTMLElement, cell: { x: number; y: number; w: number; h: number }) {
  const rect = pixelRectFor(GRID_WIDTH, cell);
  expect(element.style.transform).toBe(`translate(${rect.left}px, ${rect.top}px)`);
  expect(element.style.width).toBe(`${rect.width}px`);
  expect(element.style.height).toBe(`${rect.height}px`);
}

describe('CustomGridRenderer', () => {
  beforeEach(() => {
    mockGridWidth = GRID_WIDTH;
  });

  it('places each grid item at its cell and renders the grid item itself', async () => {
    const { container } = await setup([gridItem(1, 0, 0, 12, 8), gridItem(2, 12, 0, 12, 4), gridItem(3, 0, 8, 24, 6)]);

    expectAt(getItemElement(container, 'grid-item-1'), { x: 0, y: 0, w: 12, h: 8 });
    expectAt(getItemElement(container, 'grid-item-2'), { x: 12, y: 0, w: 12, h: 4 });
    expectAt(getItemElement(container, 'grid-item-3'), { x: 0, y: 8, w: 24, h: 6 });
    expect(getItemElement(container, 'grid-item-1')).toHaveTextContent('Panel 1');
    expect(getItemElement(container, 'grid-item-1')).toHaveTextContent('Panel content');
  });

  it('sizes the grid to its lowest item', async () => {
    const { container } = await setup([gridItem(1, 0, 0, 12, 8), gridItem(2, 0, 8, 24, 6)]);

    const gridElement = getItemElement(container, 'grid-item-1').parentElement!;
    expect(gridElement.style.height).toBe(`${containerHeightPx([{ i: 'a', x: 0, y: 0, w: 24, h: 14 }])}px`);
  });

  it('moves a grid item when its position is changed programmatically', async () => {
    const { container, grid } = await setup([gridItem(1, 0, 0, 12, 8), gridItem(2, 12, 0, 12, 8)]);

    act(() => grid.state.children[1].setState({ x: 0, y: 8, width: 24 }));

    expectAt(getItemElement(container, 'grid-item-2'), { x: 0, y: 8, w: 24, h: 8 });
  });

  it('renders grid items that are added programmatically and drops removed ones', async () => {
    const { container, grid } = await setup([gridItem(1, 0, 0, 12, 8)]);

    await act(async () => grid.setState({ children: [gridItem(2, 12, 0, 12, 8)] }));

    expect(container.querySelector('[data-griditem-key="grid-item-1"]')).not.toBeInTheDocument();
    expectAt(getItemElement(container, 'grid-item-2'), { x: 12, y: 0, w: 12, h: 8 });
  });

  it('renders overlapping items where react-grid-layout would and writes that back to the grid items', async () => {
    const { container, grid } = await setup([gridItem(1, 0, 0, 12, 8)]);

    await act(async () => grid.setState({ children: [...grid.state.children, gridItem(2, 6, 4, 12, 8)] }));

    expectAt(getItemElement(container, 'grid-item-2'), { x: 6, y: 8, w: 12, h: 8 });
    expect(grid.state.children[1].state).toMatchObject({ x: 6, y: 8 });
  });

  it('renders the grid items in the order of their positions, which is the order they are stacked in on small screens', async () => {
    const { container, grid } = await setup([gridItem(1, 0, 0, 12, 8)]);

    // Added at the end of the children, but positioned before the last one
    await act(async () =>
      grid.setState({ children: [gridItem(3, 0, 8, 24, 4), ...grid.state.children, gridItem(2, 12, 0, 12, 8)] })
    );

    const keys = Array.from(container.querySelectorAll('[data-griditem-key]')).map((element) =>
      element.getAttribute('data-griditem-key')
    );
    expect(keys).toEqual(['grid-item-1', 'grid-item-2', 'grid-item-3']);
  });

  it('renders every item at full width in a narrow grid without changing the saved layout', async () => {
    mockGridWidth = 600;
    const { container, grid } = await setup([gridItem(1, 0, 0, 12, 8), gridItem(2, 12, 0, 12, 4)]);

    const rect = pixelRectFor(600, { x: 0, y: 8, w: 24, h: 4 });
    expect(getItemElement(container, 'grid-item-2').style.transform).toBe(`translate(${rect.left}px, ${rect.top}px)`);
    expect(grid.state.children[1].state).toMatchObject({ x: 12, y: 0, width: 12 });
  });

  describe('while a panel is dragged', () => {
    const originalElementsFromPoint = document.elementsFromPoint;
    let clientWidth: jest.SpyInstance;

    beforeEach(() => {
      clientWidth = jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(GRID_WIDTH);
    });

    afterEach(() => {
      clientWidth.mockRestore();
      document.elementsFromPoint = originalElementsFromPoint;
    });

    async function startDrag() {
      const rendered = await setup([gridItem(1, 0, 0, 12, 8), gridItem(2, 12, 0, 12, 8)], { isDraggable: true });
      const { controller, grid, container } = rendered;
      const gridElement = getItemElement(container, 'grid-item-1').parentElement!;
      document.elementsFromPoint = () => [gridElement];
      act(() =>
        controller.startDrag(
          grid.state.children[1],
          { button: 0, clientX: 614, clientY: 10, target: null },
          DRAG_INFO,
          jest.fn()
        )
      );
      return { ...rendered, gridElement };
    }

    const DRAG_INFO = { offsetX: 10, offsetY: 10, width: 0, height: 0 };

    it('is a drop target for its own item', async () => {
      const { gridElement } = await startDrag();

      expect(gridElement).toHaveAttribute(DASHBOARD_DROP_TARGET_KEY_ATTR, 'grid-manager');
    });

    it('floats the dragged panel under the pointer and shows where it will land', async () => {
      const { controller, container, gridElement } = await startDrag();

      act(() => controller.onDrag({ clientX: 30, clientY: 10 + 8 * 38, buttons: 1 }));

      const dragged = getItemElement(container, 'grid-item-2');
      // In the viewport: the pointer minus where the panel was grabbed
      expect(dragged.style.transform).toBe(`translate(var(${DRAG_LEFT_VAR}, 0px), var(${DRAG_TOP_VAR}, 0px))`);
      expect(dragged.style.getPropertyValue(DRAG_LEFT_VAR)).toBe('20px');
      expect(dragged.style.getPropertyValue(DRAG_TOP_VAR)).toBe(`${8 * 38}px`);
      const placeholder = gridElement.firstElementChild as HTMLElement;
      expect(placeholder).not.toHaveAttribute('data-griditem-key');
      expectAt(placeholder, { x: 0, y: 8, w: 12, h: 8 });
      // The other panels make room live
      expectAt(getItemElement(container, 'grid-item-1'), { x: 0, y: 0, w: 12, h: 8 });
    });

    it('renders the committed layout again once the drag ends', async () => {
      const { controller, container, gridElement } = await startDrag();
      act(() => controller.onDrag({ clientX: 30, clientY: 10 + 8 * 38, buttons: 1 }));

      act(() => controller.endDrag());

      expectAt(getItemElement(container, 'grid-item-2'), { x: 12, y: 0, w: 12, h: 8 });
      expect(gridElement.querySelectorAll(':scope > :not([data-griditem-key])')).toHaveLength(0);
    });
  });

  describe('while a panel from elsewhere is dragged over the grid', () => {
    let clientWidth: jest.SpyInstance;

    beforeEach(() => {
      clientWidth = jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(GRID_WIDTH);
    });

    afterEach(() => clientWidth.mockRestore());

    it('is a drop target, and makes room for the panel where it would land', async () => {
      const { controller, container } = await setup([gridItem(1, 0, 0, 12, 8), gridItem(2, 12, 0, 12, 8)]);
      const gridElement = getItemElement(container, 'grid-item-1').parentElement!;
      expect(gridElement).toHaveAttribute(DASHBOARD_DROP_TARGET_KEY_ATTR, 'grid-manager');

      // A 12 x 4 panel from another grid, held 10px in from its top-left corner, over the top-left cell
      act(() =>
        controller.previewExternalDrag(
          gridItem(3, 0, 0, 12, 4),
          { clientX: 10, clientY: 10, buttons: 1 },
          { offsetX: 10, offsetY: 10, width: 0, height: 0 }
        )
      );

      expectAt(gridElement.firstElementChild as HTMLElement, { x: 0, y: 0, w: 12, h: 4 });
      expectAt(getItemElement(container, 'grid-item-1'), { x: 0, y: 4, w: 12, h: 8 });
      expect(container.querySelector('[data-griditem-key="grid-item-3"]')).not.toBeInTheDocument();
      expect(gridElement.style.height).toBe(`${containerHeightPx([{ i: 'a', x: 0, y: 4, w: 12, h: 8 }])}px`);

      act(() => controller.endExternalDrop());

      expectAt(getItemElement(container, 'grid-item-1'), { x: 0, y: 0, w: 12, h: 8 });
      expect(gridElement.querySelectorAll(':scope > :not([data-griditem-key])')).toHaveLength(0);
    });
  });

  it('resizes a panel from its resize handle', async () => {
    const clientWidth = jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(GRID_WIDTH);
    try {
      const { container, grid } = await setup([gridItem(1, 0, 0, 12, 8)], { isResizable: true });
      // Performs edits like the dashboard edit pane does
      grid.subscribeToEvent(DashboardEditActionEvent, ({ payload }) => payload.perform());
      const handle = getItemElement(container, 'grid-item-1').querySelector('.scene-resize-handle')!;

      // jsdom has no PointerEvent, and fireEvent.pointerDown would drop the pointer position
      fireEvent(handle, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 500, clientY: 300 }));
      act(() => {
        window.dispatchEvent(new MouseEvent('pointermove', { clientX: 600, clientY: 376, buttons: 1 }));
      });

      const resized = getItemElement(container, 'grid-item-1');
      // The panel follows the pointer (jsdom drops the var() sizes it is rendered with)
      expect(resized.style.getPropertyValue(RESIZE_WIDTH_VAR)).toBe('696px');
      expect(resized.style.getPropertyValue(RESIZE_HEIGHT_VAR)).toBe('372px');

      act(() => {
        window.dispatchEvent(new MouseEvent('pointerup', { clientX: 600, clientY: 376 }));
      });

      expect(grid.state.children[0].state).toMatchObject({ width: 14, height: 10 });
    } finally {
      clientWidth.mockRestore();
    }
  });

  describe('in view mode', () => {
    let clientWidth: jest.SpyInstance;

    beforeEach(() => {
      clientWidth = jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(GRID_WIDTH);
    });

    afterEach(() => clientWidth.mockRestore());

    it('lays out the grid items like while editing, without resize handles or a drop target', async () => {
      const { container, controller } = await setup(
        [gridItem(1, 0, 0, 12, 8), gridItem(2, 12, 0, 12, 4)],
        { isDraggable: true, isResizable: true },
        { isEditing: false }
      );

      expectAt(getItemElement(container, 'grid-item-1'), { x: 0, y: 0, w: 12, h: 8 });
      expectAt(getItemElement(container, 'grid-item-2'), { x: 12, y: 0, w: 12, h: 4 });
      expect(container.querySelector('.scene-resize-handle')).not.toBeInTheDocument();
      expect(container.querySelector(`[${DASHBOARD_DROP_TARGET_KEY_ATTR}]`)).not.toBeInTheDocument();
      expect(controller.isRendered()).toBe(false);
    });

    it('starts no drags', async () => {
      const { controller, grid } = await setup([gridItem(1, 0, 0, 12, 8)], { isDraggable: true }, { isEditing: false });
      const handle = document.createElement('div');
      handle.className = grid.getDragClass();

      expect(
        controller.canStartDrag({ button: 0, clientX: 10, clientY: 10, target: handle }, grid.state.children[0])
      ).toBe(false);
    });

    it('gains resize handles and becomes a drop target when editing starts, without remounting its items', async () => {
      const { container, controller, setEditing } = await setup(
        [gridItem(1, 0, 0, 12, 8)],
        { isResizable: true },
        { isEditing: false }
      );
      const itemElement = getItemElement(container, 'grid-item-1');

      act(() => setEditing(true));

      expect(getItemElement(container, 'grid-item-1')).toBe(itemElement);
      expect(itemElement.querySelector('.scene-resize-handle')).toBeInTheDocument();
      expect(itemElement.parentElement).toHaveAttribute(DASHBOARD_DROP_TARGET_KEY_ATTR, 'grid-manager');
      expect(controller.isRendered()).toBe(true);
    });
  });

  describe('lazy loading', () => {
    let observe: jest.SpyInstance;

    beforeEach(() => {
      // Nothing comes into view until the test says so
      observe = jest.spyOn(LazyLoader.observer, 'observe').mockImplementation(() => {});
    });

    afterEach(() => observe.mockRestore());

    function scrollIntoView(element: HTMLElement) {
      act(() =>
        LazyLoader.callbacks[element.id]({
          target: element,
          isIntersecting: true,
        } as unknown as IntersectionObserverEntry)
      );
    }

    it('lets the panels of a lazy grid query only once they are in view, like the react-grid-layout grid', async () => {
      const first = panelWithData(1, 0);
      const second = panelWithData(2, 8);
      // With preload on, the grid items do not wrap their panels in a lazy loader of their own
      const { container } = await setup(
        [first.item, second.item],
        { isLazy: true },
        { isEditing: false, preload: true }
      );
      expect(first.data.inView).toEqual([false]);
      expect(second.data.inView).toEqual([false]);

      scrollIntoView(getItemElement(container, 'grid-item-2'));

      expect(first.data.inView).toEqual([false]);
      expect(second.data.inView).toEqual([false, true]);
      // The panel is rendered either way, only its queries wait
      expect(getItemElement(container, 'grid-item-1')).toHaveTextContent('Panel 1');
    });

    it('lets every panel query straight away when the grid is not lazy', async () => {
      const first = panelWithData(1, 0);
      const second = panelWithData(2, 8);

      await setup([first.item, second.item], { isLazy: false }, { isEditing: false, preload: true });

      expect(first.data.inView).toEqual([true]);
      expect(second.data.inView).toEqual([true]);
      expect(observe).not.toHaveBeenCalled();
    });
  });

  it('shows resize handles only when the grid is resizable', async () => {
    const { container, grid } = await setup([gridItem(1, 0, 0, 12, 8)], { isResizable: false });
    expect(container.querySelector('.scene-resize-handle')).not.toBeInTheDocument();

    act(() => grid.setState({ isResizable: true }));

    expect(getItemElement(container, 'grid-item-1').querySelector('.scene-resize-handle')).toBeInTheDocument();
  });
});
