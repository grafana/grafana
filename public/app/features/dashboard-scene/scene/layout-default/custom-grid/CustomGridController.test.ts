import { logWarning } from '@grafana/runtime';
import { SceneGridLayout, VizPanel } from '@grafana/scenes';

import { DashboardGridItem } from '../DashboardGridItem';

import { CustomGridController } from './CustomGridController';

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
