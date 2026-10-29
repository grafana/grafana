import { type Unsubscribable } from 'rxjs';

import { type SceneGridItemLike, type SceneGridLayout } from '@grafana/scenes';
import { GRID_COLUMN_COUNT } from 'app/core/constants';

import { type LayoutSnapshotLayout } from '../../types/DashboardDropTarget';

import { getLayoutKey, gridItemsToLayout } from './gridItemLayout';
import { type GridLayoutItem } from './gridMath';
import { correctLayout, ensureValidLayout } from './layoutValidation';

/**
 * Owns the layout of one custom grid. The layout is derived from the positions on the grid items
 * (`x`, `y`, `width`, `height`), so it follows any change made to them, including programmatic ones by
 * the assistant or undo. Positions are only changed through `applyLayout`, which validates the layout
 * first.
 *
 * Only used with the unified drag and drop flag on.
 */
export class CustomGridController {
  private _listeners = new Set<() => void>();
  private _gridSub: Unsubscribable | undefined;
  private _childSubs: Unsubscribable[] = [];
  private _cells: GridLayoutItem[] = [];
  private _layout: GridLayoutItem[] = [];
  private _narrowLayout: GridLayoutItem[] | undefined;
  private _hasRenderFailed = false;

  public constructor(public readonly grid: SceneGridLayout) {}

  /** Listens for changes of the layout. Scene state is only watched while someone is subscribed. */
  public subscribe = (listener: () => void) => {
    this._listeners.add(listener);
    if (this._listeners.size === 1) {
      this._watchGrid();
    }

    return () => {
      this._listeners.delete(listener);
      if (this._listeners.size === 0) {
        this._unwatchGrid();
      }
    };
  };

  /**
   * The layout the grid is rendered with: the grid items' positions, normalized the way
   * react-grid-layout normalizes them. Keyed by panel key. Returns the same array until a position
   * or the grid's children change.
   */
  public getLayout = (): GridLayoutItem[] => {
    this._refresh();
    return this._layout;
  };

  /** The layout for a grid too narrow for columns: every item is full width, in the same order. */
  public getNarrowLayout(): GridLayoutItem[] {
    this._refresh();
    if (!this._narrowLayout) {
      this._narrowLayout = correctLayout(this._cells.map((cell) => ({ ...cell, w: GRID_COLUMN_COUNT })));
    }
    return this._narrowLayout;
  }

  /**
   * Writes the rendered layout back onto the grid items when they differ, like react-grid-layout
   * reports the layout it normalized. Not an undoable change, same as with react-grid-layout.
   */
  public syncGridItems() {
    const layout = this.getLayout();
    if (!isInSync(this.grid.state.children, layout)) {
      this.applyLayout(layout);
    }
  }

  /**
   * Moves the grid items to the given positions. Items not in the layout keep theirs. An invalid result
   * is corrected (and reported) instead of being applied. Also the target of layout snapshots.
   */
  public applyLayout = (layout: LayoutSnapshotLayout) => {
    const children = this.grid.state.children;
    const updates = new Map(layout.map((item) => [item.i, item]));
    const merged = gridItemsToLayout(children).map((cell) => updates.get(cell.i) ?? cell);
    const valid = new Map(ensureValidLayout(merged, 'commit').map((item) => [item.i, item]));

    for (const child of children) {
      const item = valid.get(getLayoutKey(child));
      if (!item) {
        continue;
      }
      const { x, y, width, height } = child.state;
      if (x !== item.x || y !== item.y || width !== item.w || height !== item.h) {
        child.setState({ x: item.x, y: item.y, width: item.w, height: item.h });
      }
    }

    const sorted = sortByPosition(children);
    if (sorted.some((child, index) => child !== children[index])) {
      this.grid.setState({ children: sorted });
    }
  };

  /** The grid item a layout item belongs to */
  public getGridItem(key: string): SceneGridItemLike | undefined {
    return this.grid.state.children.find((child) => getLayoutKey(child) === key);
  }

  public hasRenderFailed(): boolean {
    return this._hasRenderFailed;
  }

  /** Makes this grid use the old renderer from now on. Returns true the first time. */
  public markRenderFailed(): boolean {
    const isFirstFailure = !this._hasRenderFailed;
    this._hasRenderFailed = true;
    return isFirstFailure;
  }

  private _refresh() {
    const cells = gridItemsToLayout(this.grid.state.children);
    if (isSameSequence(cells, this._cells)) {
      return;
    }
    // A new array even when normalizing gives the same result, so the renderer writes it back again
    this._cells = cells;
    this._layout = correctLayout(cells);
    this._narrowLayout = undefined;
  }

  private _watchGrid() {
    this._gridSub = this.grid.subscribeToState((next, prev) => {
      if (next.children !== prev.children) {
        this._watchChildren(next.children);
        this._notify();
      }
    });
    this._watchChildren(this.grid.state.children);
  }

  private _watchChildren(children: SceneGridItemLike[]) {
    this._childSubs.forEach((sub) => sub.unsubscribe());
    this._childSubs = children.map((child) =>
      child.subscribeToState((next, prev) => {
        if (next.x !== prev.x || next.y !== prev.y || next.width !== prev.width || next.height !== prev.height) {
          this._notify();
        }
      })
    );
  }

  private _unwatchGrid() {
    this._gridSub?.unsubscribe();
    this._gridSub = undefined;
    this._childSubs.forEach((sub) => sub.unsubscribe());
    this._childSubs = [];
  }

  private _notify() {
    this._listeners.forEach((listener) => listener());
  }
}

function isSameSequence(a: readonly GridLayoutItem[], b: readonly GridLayoutItem[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (item, index) =>
        item.i === b[index].i &&
        item.x === b[index].x &&
        item.y === b[index].y &&
        item.w === b[index].w &&
        item.h === b[index].h
    )
  );
}

function isInSync(children: readonly SceneGridItemLike[], layout: readonly GridLayoutItem[]): boolean {
  const byKey = new Map(layout.map((item) => [item.i, item]));
  const inPlace = children.every((child) => {
    const item = byKey.get(getLayoutKey(child));
    const { x, y, width, height } = child.state;
    return !item || (x === item.x && y === item.y && width === item.w && height === item.h);
  });
  return inPlace && sortByPosition(children).every((child, index) => child === children[index]);
}

// Same order scenes keeps the children in, which is also the order panels are read in on narrow screens
function sortByPosition(children: readonly SceneGridItemLike[]): SceneGridItemLike[] {
  return [...children].sort((a, b) => (a.state.y ?? 0) - (b.state.y ?? 0) || (a.state.x ?? 0) - (b.state.x ?? 0));
}
