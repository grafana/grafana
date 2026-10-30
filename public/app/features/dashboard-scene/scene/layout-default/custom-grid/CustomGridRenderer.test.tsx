import { act, fireEvent } from '@testing-library/react';
import { render } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneGridLayout, SceneTimeRange, VizPanel } from '@grafana/scenes';

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

async function setup(children: DashboardGridItem[], gridState: Partial<SceneGridLayout['state']> = {}) {
  const grid = new SceneGridLayout({ children, ...gridState });
  const manager = new DefaultGridLayoutManager({ grid });
  new DashboardScene({ title: 'Custom grid', $timeRange: new SceneTimeRange({}), body: manager, isEditing: true });
  const controller = manager.getCustomGridController();
  const { container } = render(<CustomGridRenderer grid={grid} controller={controller} dropTargetKey="grid-manager" />);
  // Let the panels finish loading their plugin
  await act(async () => {});
  return { grid, controller, container };
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

  it('shows resize handles only when the grid is resizable', async () => {
    const { container, grid } = await setup([gridItem(1, 0, 0, 12, 8)], { isResizable: false });
    expect(container.querySelector('.scene-resize-handle')).not.toBeInTheDocument();

    act(() => grid.setState({ isResizable: true }));

    expect(getItemElement(container, 'grid-item-1').querySelector('.scene-resize-handle')).toBeInTheDocument();
  });
});
