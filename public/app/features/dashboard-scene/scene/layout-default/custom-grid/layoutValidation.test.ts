import { logWarning } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { SceneGridLayout, SceneGridRow, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { type GridLayoutItemKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { transformSceneToSaveModel } from '../../../serialization/transformSceneToSaveModel';
import { DashboardScene } from '../../DashboardScene';
import { DashboardGridItem } from '../DashboardGridItem';
import { DefaultGridLayoutManager } from '../DefaultGridLayoutManager';

import { type GridLayoutItem } from './gridMath';
import { correctLayout, ensureValidLayout, getCorrectedPlacementForSave, validateLayout } from './layoutValidation';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  logWarning: jest.fn(),
}));

function item(i: string, x: number, y: number, w: number, h: number): GridLayoutItem {
  return { i, x, y, w, h };
}

function gridItem(id: number, x: number, y: number, width: number, height: number) {
  return new DashboardGridItem({
    key: `grid-item-${id}`,
    x,
    y,
    width,
    height,
    body: new VizPanel({ key: `panel-${id}`, title: `Panel ${id}`, pluginId: 'timeseries' }),
  });
}

function setupDashboard(children: DashboardGridItem[]) {
  const grid = new SceneGridLayout({ children });
  const manager = new DefaultGridLayoutManager({ grid });
  const scene = new DashboardScene({
    title: 'Validation',
    uid: 'validation',
    $timeRange: new SceneTimeRange({}),
    body: manager,
  });
  return { scene, manager, grid };
}

function savedV2Positions(manager: DefaultGridLayoutManager) {
  const layout = manager.serialize();
  if (layout.kind !== 'GridLayout') {
    throw new Error('Expected a grid layout');
  }
  return layout.spec.items.map(({ spec }: GridLayoutItemKind) => ({
    x: spec.x,
    y: spec.y,
    width: spec.width,
    height: spec.height,
  }));
}

function savedV1Positions(scene: DashboardScene) {
  return transformSceneToSaveModel(scene).panels?.map((panel) => panel.gridPos);
}

describe('validateLayout', () => {
  it('accepts a layout with gaps, since nothing overlaps or sticks out', () => {
    expect(validateLayout([item('a', 0, 0, 12, 4), item('b', 12, 10, 12, 4), item('c', 0, 20, 24, 2)])).toEqual({
      isValid: true,
      overlapCount: 0,
      outOfBoundsCount: 0,
      invalidValueCount: 0,
    });
  });

  it('counts each overlapping pair, items past the last column and unusable values', () => {
    const validation = validateLayout([
      item('a', 0, 0, 12, 4),
      item('b', 6, 2, 12, 4),
      item('c', 8, 3, 2, 2),
      item('d', 20, 10, 8, 2),
      item('e', -1, 20, 4, 2),
      item('f', 0, NaN, 4, 2),
      item('g', 0, 30, 0, 2),
    ]);

    expect(validation).toEqual({ isValid: false, overlapCount: 3, outOfBoundsCount: 1, invalidValueCount: 3 });
  });
});

describe('correctLayout', () => {
  it('turns an invalid layout into a valid one with every item kept', () => {
    const corrected = correctLayout([
      item('a', 0, 0, 12, 4),
      item('b', 6, 2, 12, 4),
      item('c', 20, 0, 8, 2),
      item('d', -3, -5, Infinity, 0),
    ]);

    expect(validateLayout(corrected).isValid).toBe(true);
    expect(corrected.map(({ i }) => i).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(corrected.find(({ i }) => i === 'c')).toMatchObject({ x: 16, w: 8 });
  });
});

describe('ensureValidLayout', () => {
  afterEach(() => jest.mocked(logWarning).mockClear());

  it('returns a valid layout unchanged without reporting it', () => {
    const layout = [item('a', 0, 0, 12, 4), item('b', 12, 0, 12, 4)];

    expect(ensureValidLayout(layout, 'commit')).toBe(layout);
    expect(logWarning).not.toHaveBeenCalled();
  });

  it('returns the corrected layout of an invalid one and reports only counts', () => {
    const layout = [item('panel-1', 0, 0, 12, 4), item('panel-2', 0, 0, 12, 4)];

    const valid = ensureValidLayout(layout, 'commit');

    expect(valid).toEqual([item('panel-1', 0, 0, 12, 4), item('panel-2', 0, 4, 12, 4)]);
    expect(logWarning).toHaveBeenCalledTimes(1);
    expect(logWarning).toHaveBeenCalledWith('Corrected an invalid custom grid layout', {
      context: 'commit',
      itemCount: '2',
      overlapCount: '1',
      outOfBoundsCount: '0',
      invalidValueCount: '0',
    });
  });
});

describe('getCorrectedPlacementForSave', () => {
  afterEach(() => {
    setTestFlags({});
    jest.mocked(logWarning).mockClear();
  });

  it('is not used with the unified drag and drop flag off, so invalid layouts are saved as today', () => {
    setTestFlags({ [FlagKeys.GrafanaDashboardUnifiedDragAndDrop]: false });
    const { scene, manager, grid } = setupDashboard([gridItem(1, 0, 0, 12, 8), gridItem(2, 6, 4, 12, 8)]);

    expect(getCorrectedPlacementForSave(grid.state.children[1])).toBeUndefined();
    expect(savedV2Positions(manager)).toEqual([
      { x: 0, y: 0, width: 12, height: 8 },
      { x: 6, y: 4, width: 12, height: 8 },
    ]);
    expect(savedV1Positions(scene)).toEqual([
      { x: 0, y: 0, w: 12, h: 8 },
      { x: 6, y: 4, w: 12, h: 8 },
    ]);
    expect(logWarning).not.toHaveBeenCalled();
  });

  describe('with the unified drag and drop flag on', () => {
    beforeEach(() => setTestFlags({ [FlagKeys.GrafanaDashboardUnifiedDragAndDrop]: true }));

    it('leaves valid layouts to be saved as they are', () => {
      const { scene, manager, grid } = setupDashboard([gridItem(1, 0, 0, 12, 8), gridItem(2, 12, 20, 12, 8)]);

      expect(grid.state.children.map(getCorrectedPlacementForSave)).toEqual([undefined, undefined]);
      expect(savedV2Positions(manager)).toEqual([
        { x: 0, y: 0, width: 12, height: 8 },
        { x: 12, y: 20, width: 12, height: 8 },
      ]);
      expect(savedV1Positions(scene)).toEqual([
        { x: 0, y: 0, w: 12, h: 8 },
        { x: 12, y: 20, w: 12, h: 8 },
      ]);
    });

    it('saves overlapping and out of bounds items at corrected positions in both schema versions', () => {
      const { scene, manager } = setupDashboard([
        gridItem(1, 0, 0, 12, 8),
        gridItem(2, 6, 4, 12, 8),
        gridItem(3, 20, 0, 8, 8),
      ]);

      // The grid keeps its children sorted by position
      const expected = [
        { x: 0, y: 0, width: 12, height: 8 },
        { x: 16, y: 0, width: 8, height: 8 },
        { x: 6, y: 8, width: 12, height: 8 },
      ];
      expect(savedV2Positions(manager)).toEqual(expected);
      expect(savedV1Positions(scene)).toEqual(
        expected.map(({ x, y, width, height }) => ({ x, y, w: width, h: height }))
      );
    });

    it('does not change the grid items when saving', () => {
      const { manager, grid } = setupDashboard([gridItem(1, 0, 0, 12, 8), gridItem(2, 6, 4, 12, 8)]);

      savedV2Positions(manager);

      expect(grid.state.children[1].state).toMatchObject({ x: 6, y: 4, width: 12, height: 8 });
    });

    it('reports an invalid layout once, not once per saved item or save', () => {
      const { scene, manager } = setupDashboard([gridItem(1, 0, 0, 12, 8), gridItem(2, 0, 0, 12, 8)]);

      savedV2Positions(manager);
      savedV1Positions(scene);

      expect(logWarning).toHaveBeenCalledTimes(1);
      expect(logWarning).toHaveBeenCalledWith(
        'Corrected an invalid custom grid layout',
        expect.objectContaining({ context: 'save', itemCount: '2', overlapCount: '1' })
      );
    });

    it('checks the layout again after a position changes', () => {
      const { manager, grid } = setupDashboard([gridItem(1, 0, 0, 12, 8), gridItem(2, 12, 0, 12, 8)]);
      expect(savedV2Positions(manager)[1]).toEqual({ x: 12, y: 0, width: 12, height: 8 });

      grid.state.children[1].setState({ x: 6 });

      expect(savedV2Positions(manager)[1]).toEqual({ x: 6, y: 8, width: 12, height: 8 });
    });

    it('keeps saving the height of one repeated panel for repeats', () => {
      const repeat = gridItem(2, 0, 0, 12, 16);
      repeat.setState({ variableName: 'server', itemHeight: 8 });
      const { manager } = setupDashboard([gridItem(1, 0, 0, 12, 8), repeat]);

      expect(savedV2Positions(manager)).toEqual([
        { x: 0, y: 0, width: 12, height: 8 },
        { x: 0, y: 8, width: 12, height: 8 },
      ]);
    });

    it('leaves grids with rows alone, since they are not rendered by the new grid', () => {
      const grid = new SceneGridLayout({
        children: [
          gridItem(1, 0, 0, 12, 8),
          gridItem(2, 0, 0, 12, 8),
          new SceneGridRow({ key: 'row', y: 8, children: [] }),
        ],
      });

      expect(grid.state.children.map(getCorrectedPlacementForSave)).toEqual([undefined, undefined, undefined]);
    });
  });
});
