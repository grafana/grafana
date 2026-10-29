import { act } from '@testing-library/react';
import { render } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneGridLayout, SceneTimeRange, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../../DashboardScene';
import { DashboardGridItem } from '../DashboardGridItem';
import { DefaultGridLayoutManager } from '../DefaultGridLayoutManager';

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
  const { container } = render(<CustomGridRenderer grid={grid} controller={controller} />);
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

  it('shows resize handles only when the grid is resizable', async () => {
    const { container, grid } = await setup([gridItem(1, 0, 0, 12, 8)], { isResizable: false });
    expect(container.querySelector('.scene-resize-handle')).not.toBeInTheDocument();

    act(() => grid.setState({ isResizable: true }));

    expect(getItemElement(container, 'grid-item-1').querySelector('.scene-resize-handle')).toBeInTheDocument();
  });
});
