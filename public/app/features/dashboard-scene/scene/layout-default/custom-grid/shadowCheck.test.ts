import { createElement } from 'react';

import { logDebug, logMeasurement } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { SceneGridLayout, SceneGridRow, VizPanel } from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { DashboardGridItem } from '../DashboardGridItem';
import { DefaultGridLayoutManager } from '../DefaultGridLayoutManager';

import { normalizeLayout } from './gridMath';
import { GRID_SHADOW_CHECK_MEASUREMENT, startGridShadowCheck } from './shadowCheck';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  logDebug: jest.fn(),
  logMeasurement: jest.fn(),
}));

jest.mock('./gridMath', () => {
  const actual = jest.requireActual('./gridMath');
  return { ...actual, normalizeLayout: jest.fn(actual.normalizeLayout) };
});

interface V1Grid {
  state: object;
  setState(partial: object): void;
  componentDidMount(): void;
}

interface V1GridClass {
  new (props: object): V1Grid;
  defaultProps: object;
}

const ReactGridLayout = jest.requireActual<{ default: V1GridClass }>('react-grid-layout/build/ReactGridLayout').default;

// Mounts react-grid-layout the way SceneGridLayoutRenderer does, without rendering: the constructor
// compacts the layout and componentDidMount reports it through onLayoutChange.
function mountReactGridLayout(grid: SceneGridLayout, width = 1200) {
  const layout = grid.buildGridLayout(width, 800);
  const rgl = new ReactGridLayout({
    ...ReactGridLayout.defaultProps,
    width,
    cols: 24,
    rowHeight: 30,
    margin: [8, 8],
    containerPadding: [0, 0],
    isBounded: false,
    layout,
    onLayoutChange: grid.onLayoutChange,
    children: layout.map((item) => createElement('div', { key: item.i })),
  });
  rgl.setState = (partial: object) => {
    rgl.state = { ...rgl.state, ...partial };
  };
  rgl.componentDidMount();
}

function gridItem(key: string, x?: number, y?: number, width?: number, height?: number) {
  return new DashboardGridItem({ key, x, y, width, height, body: new VizPanel({ key: `panel-${key}` }) });
}

// Has a gap, an overlap, an item sticking out on the right and an item without a size
function createMessyGrid() {
  return new SceneGridLayout({
    children: [
      gridItem('a', 0, 5, 12, 4),
      gridItem('b', 6, 5, 12, 4),
      gridItem('c', 20, 0, 8, 3),
      gridItem('d', 0, 20, undefined, NaN),
      gridItem('e', 12, 0, 4, 2),
    ],
  });
}

function placement(grid: SceneGridLayout, key: string) {
  const { x, y, width, height } = grid.state.children.find((child) => child.state.key === key)!.state;
  return { x, y, width, height };
}

describe('startGridShadowCheck', () => {
  beforeEach(() => {
    setTestFlags({ [FlagKeys.GrafanaDashboardGridShadowCheck]: true });
    jest.spyOn(Math, 'random').mockReturnValue(0.05);
  });

  afterEach(() => {
    setTestFlags({});
    jest.restoreAllMocks();
    jest.mocked(logMeasurement).mockClear();
    jest.mocked(logDebug).mockClear();
  });

  it('reports no mismatches when react-grid-layout and normalizeLayout agree on a messy layout', () => {
    const grid = createMessyGrid();
    const deactivate = new DefaultGridLayoutManager({ grid }).activate();

    mountReactGridLayout(grid);

    expect(placement(grid, 'b')).toEqual({ x: 6, y: 4, width: 12, height: 4 });
    expect(logMeasurement).toHaveBeenCalledTimes(1);
    expect(logMeasurement).toHaveBeenCalledWith(GRID_SHADOW_CHECK_MEASUREMENT, {
      sampleRate: 0.1,
      itemCount: 5,
      mismatchedItemCount: 0,
      maxAbsDeltaX: 0,
      maxAbsDeltaY: 0,
      maxAbsDeltaW: 0,
      maxAbsDeltaH: 0,
      movedItemCount: 4,
      savedLayoutWasNormalized: 0,
    });
    deactivate();
  });

  it('reports a saved layout react-grid-layout leaves alone as already normalized', () => {
    const grid = new SceneGridLayout({ children: [gridItem('a', 0, 0, 12, 4), gridItem('b', 12, 0, 12, 6)] });
    const deactivate = new DefaultGridLayoutManager({ grid }).activate();

    mountReactGridLayout(grid);

    expect(logMeasurement).toHaveBeenCalledWith(
      GRID_SHADOW_CHECK_MEASUREMENT,
      expect.objectContaining({ itemCount: 2, mismatchedItemCount: 0, movedItemCount: 0, savedLayoutWasNormalized: 1 })
    );
    deactivate();
  });

  it('counts the items react-grid-layout placed differently and the largest differences', () => {
    const grid = createMessyGrid();
    const deactivate = new DefaultGridLayoutManager({ grid }).activate();

    // b is 3 rows lower and d 2 columns further right than react-grid-layout would put them
    grid.onLayoutChange([
      { i: 'e', x: 12, y: 0, w: 4, h: 2 },
      { i: 'c', x: 16, y: 0, w: 8, h: 3 },
      { i: 'a', x: 0, y: 0, w: 12, h: 4 },
      { i: 'b', x: 6, y: 7, w: 12, h: 4 },
      { i: 'd', x: 2, y: 4, w: 4, h: 4 },
    ]);

    expect(logMeasurement).toHaveBeenCalledWith(GRID_SHADOW_CHECK_MEASUREMENT, {
      sampleRate: 0.1,
      itemCount: 5,
      mismatchedItemCount: 2,
      maxAbsDeltaX: 2,
      maxAbsDeltaY: 3,
      maxAbsDeltaW: 0,
      maxAbsDeltaH: 0,
      movedItemCount: 4,
      savedLayoutWasNormalized: 0,
    });
    deactivate();
  });

  it('reports only the first layout of a grid', () => {
    const grid = createMessyGrid();
    const manager = new DefaultGridLayoutManager({ grid });
    // Activated twice, like in React strict mode
    manager.activate()();
    const deactivate = manager.activate();
    mountReactGridLayout(grid);
    mountReactGridLayout(grid);
    deactivate();
    manager.activate();
    mountReactGridLayout(grid);

    expect(logMeasurement).toHaveBeenCalledTimes(1);
    expect(logMeasurement).toHaveBeenCalledWith(
      GRID_SHADOW_CHECK_MEASUREMENT,
      expect.objectContaining({ movedItemCount: 4 })
    );
  });

  it('waits for a layout that is not stacked for a narrow screen', () => {
    const grid = createMessyGrid();
    const deactivate = new DefaultGridLayoutManager({ grid }).activate();

    mountReactGridLayout(grid, 700);
    expect(placement(grid, 'b')).toEqual({ x: 6, y: 5, width: 12, height: 4 });
    expect(logMeasurement).not.toHaveBeenCalled();

    mountReactGridLayout(grid, 1200);
    expect(logMeasurement).toHaveBeenCalledWith(
      GRID_SHADOW_CHECK_MEASUREMENT,
      expect.objectContaining({ mismatchedItemCount: 0, movedItemCount: 4 })
    );
    deactivate();
  });

  it('does not subscribe or report when the flag is off', () => {
    setTestFlags({ [FlagKeys.GrafanaDashboardGridShadowCheck]: false });
    const grid = createMessyGrid();
    const subscribeToState = jest.spyOn(grid, 'subscribeToState');

    expect(startGridShadowCheck(grid)).toBeUndefined();
    mountReactGridLayout(grid);

    expect(placement(grid, 'b')).toEqual({ x: 6, y: 4, width: 12, height: 4 });
    expect(subscribeToState).not.toHaveBeenCalled();
    expect(logMeasurement).not.toHaveBeenCalled();
  });

  it('does not subscribe or report when the load is not sampled', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.1);
    const grid = createMessyGrid();
    const subscribeToState = jest.spyOn(grid, 'subscribeToState');

    expect(startGridShadowCheck(grid)).toBeUndefined();
    mountReactGridLayout(grid);

    expect(placement(grid, 'b')).toEqual({ x: 6, y: 4, width: 12, height: 4 });
    expect(subscribeToState).not.toHaveBeenCalled();
    expect(logMeasurement).not.toHaveBeenCalled();
  });

  it('stops listening when the layout manager deactivates before the first layout', () => {
    const grid = createMessyGrid();
    const manager = new DefaultGridLayoutManager({ grid });
    const subscribeToState = jest.spyOn(grid, 'subscribeToState');
    manager.activate()();

    // The layout manager subscribes to the grid too
    expect(subscribeToState).toHaveBeenCalledTimes(2);
    mountReactGridLayout(grid);

    expect(placement(grid, 'b')).toEqual({ x: 6, y: 4, width: 12, height: 4 });
    expect(logMeasurement).not.toHaveBeenCalled();
  });

  it('swallows an error thrown while comparing and leaves the layout to react-grid-layout', () => {
    jest.mocked(normalizeLayout).mockImplementationOnce(() => {
      throw new Error('comparison failed');
    });
    const grid = createMessyGrid();
    const deactivate = new DefaultGridLayoutManager({ grid }).activate();

    expect(() => mountReactGridLayout(grid)).not.toThrow();

    expect(placement(grid, 'b')).toEqual({ x: 6, y: 4, width: 12, height: 4 });
    expect(logDebug).toHaveBeenCalledWith('Grid shadow check failed');
    expect(logMeasurement).not.toHaveBeenCalled();
    deactivate();
  });

  it('skips a grid that contains rows', () => {
    const grid = new SceneGridLayout({
      children: [
        gridItem('a', 0, 5, 12, 4),
        new SceneGridRow({ key: 'row', title: 'Row', x: 0, y: 9, width: 24, height: 1, children: [] }),
      ],
    });
    const subscribeToState = jest.spyOn(grid, 'subscribeToState');

    expect(startGridShadowCheck(grid)).toBeUndefined();
    mountReactGridLayout(grid);

    expect(placement(grid, 'a')).toEqual({ x: 0, y: 0, width: 12, height: 4 });
    expect(subscribeToState).not.toHaveBeenCalled();
    expect(logMeasurement).not.toHaveBeenCalled();
  });
});
