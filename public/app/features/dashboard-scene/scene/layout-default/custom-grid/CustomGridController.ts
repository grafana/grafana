import { type Unsubscribable } from 'rxjs';

import { t } from '@grafana/i18n';
import { type SceneGridItemLike, type SceneGridLayout, VizPanel } from '@grafana/scenes';
import { GRID_COLUMN_COUNT } from 'app/core/constants';

import { moveElement } from '../../../actions/element/moveElement';
import { edit } from '../../../actions/utils/edit';
import { isRepeatCloneOrChildOf } from '../../../utils/clone';
import {
  DASHBOARD_DROP_TARGET_KEY_ATTR,
  type GridItemDragInfo,
  type LayoutSnapshot,
  type LayoutSnapshotLayout,
} from '../../types/DashboardDropTarget';

import { getLayoutKey, gridItemsToLayout } from './gridItemLayout';
import {
  autoGridItemSizeToGridSize,
  cellFromPixels,
  compact,
  type GridLayoutItem,
  isSameLayout,
  pixelRectFor,
  previewInsert,
  previewMove,
  previewRemove,
  previewResize,
  sizeFromPixels,
} from './gridMath';
import { correctLayout, ensureValidLayout } from './layoutValidation';

export const GRID_ITEM_KEY_ATTR = 'data-griditem-key';

/** Below this grid width every panel is full width, same as in the react-grid-layout grid */
export const NARROW_GRID_MAX_WIDTH = 768;

/** How far the pointer moves before a press on a panel header lifts the panel, so a click stays a click */
const DRAG_THRESHOLD_PX = 4;

/** Where a new panel is held while it is dragged in from the Add pane: about the middle of its header */
const NEW_PANEL_GRAB_TOP_PX = 16;

/**
 * Position of the dragged item and size of the resized item. They are set on that item's element on
 * every pointer move instead of being rendered, so only the item is restyled. Set on the item rather
 * than the grid, because custom properties inherit: on the grid they would restyle every panel.
 */
export const DRAG_LEFT_VAR = '--custom-grid-drag-left';
export const DRAG_TOP_VAR = '--custom-grid-drag-top';
export const RESIZE_WIDTH_VAR = '--custom-grid-resize-width';
export const RESIZE_HEIGHT_VAR = '--custom-grid-resize-height';

/** Layout key of a new panel from the Add pane while it is previewed, before it gets its own key */
export const NEW_PANEL_DROP_KEY = 'custom-grid-new-panel';

/**
 * A drag or resize of one of the grid's items, or an item from elsewhere (another layout, or a new panel)
 * previewed where it would be dropped, as the grid renders it
 */
export interface CustomGridInteraction {
  kind: 'drag' | 'resize' | 'drop';
  /** Layout key of the dragged, resized or dropped item */
  key: string;
  /** A press only becomes a drag once the pointer moved a bit. Until then nothing moves. */
  isActive: boolean;
  /** Rendered instead of the grid items' positions. Without the dragged item while it is outside the grid. */
  preview: GridLayoutItem[];
  /** The dragged item is over another drop target, so it would leave this grid if dropped */
  isOutside: boolean;
  /** Pixel size of the item when the interaction started */
  startSize: { width: number; height: number };
}

interface Session extends CustomGridInteraction {
  gridItemKey: string;
  /** Layout when the interaction started, restored on undo */
  before: GridLayoutItem[];
  startX: number;
  startY: number;
  /** For drags: offset from the pointer to the item's top-left corner */
  offsetX: number;
  offsetY: number;
  /** Pixel position of the item in the grid. For drags it follows the pointer, so the item can be placed again when the grid mounts again mid-drag. */
  left: number;
  top: number;
  /** For drags: ends the drag in the layout orchestrator when the grid cancels it */
  onCancel?: () => void;
}

/** An item from elsewhere dragged over the grid */
interface ExternalDrop {
  key: string;
  /** Layout when the item came over the grid, restored on undo */
  before: GridLayoutItem[];
  preview: GridLayoutItem[];
  /** Pixel size of the item in this grid */
  size: { width: number; height: number };
}

type PointerPosition = Pick<PointerEvent, 'clientX' | 'clientY' | 'buttons'>;
type PointerPress = Pick<PointerEvent, 'clientX' | 'clientY' | 'button' | 'target'>;

/**
 * Owns the layout of one custom grid. The layout is derived from the positions on the grid items
 * (`x`, `y`, `width`, `height`), so it follows any change made to them, including programmatic ones by
 * the assistant or undo. Positions are only changed through `applyLayout`, which validates the layout
 * first.
 *
 * It also runs drags and resizes of the grid's items: they are previewed without touching the grid items,
 * and committed as one undoable edit with every item's position before and after.
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
  private _container: HTMLElement | null = null;
  private _session: Session | null = null;
  private _externalDrop: ExternalDrop | null = null;
  private _interaction: CustomGridInteraction | null = null;

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

  /** The grid container of the new grid while it is rendered. Ref callback for the renderer. */
  public setContainer = (element: HTMLElement | null) => {
    this._container = element;
    if (!element && this._session?.kind === 'resize') {
      this._cancel();
    }
    // The grid can be mounted again mid-drag, e.g. when the drag switches back to the grid's tab
    if (element && this._session?.kind === 'drag' && this._session.isActive) {
      this._setDragPosition(this._session.left, this._session.top);
    }
    if (!element) {
      this.endExternalDrop();
    }
  };

  /** Whether the new grid currently renders this layout */
  public isRendered(): boolean {
    return this._container !== null;
  }

  /** The drag or resize in progress. Returns the same object until it changes. */
  public getInteraction = (): CustomGridInteraction | null => this._interaction;

  /**
   * Whether a press starts a drag of the grid item, with the same rules as the react-grid-layout grid:
   * only with the primary button on the item's drag handle (and not on a part of it that cancels drags),
   * not for items that are not draggable or are repeat clones, and not in grids too narrow for columns.
   */
  public canStartDrag(evt: PointerPress, gridItem: SceneGridItemLike): boolean {
    const target = evt.target;
    return (
      this.grid.isDraggable() &&
      !this._session &&
      evt.button === 0 &&
      gridItem.parent === this.grid &&
      gridItem.state.isDraggable !== false &&
      !isRepeatCloneOrChildOf(gridItem) &&
      (this._container?.clientWidth ?? 0) > NARROW_GRID_MAX_WIDTH &&
      target instanceof Element &&
      !!target.closest(`.${this.grid.getDragClass()}`) &&
      !target.closest(`.${this.grid.getDragClassCancel()}`)
    );
  }

  /**
   * Starts dragging a grid item of this grid. The layout orchestrator drives the drag: it passes the
   * pointer moves to `onDrag`, commits a drop within the grid through `commitDrag` and ends the drag
   * with `endDrag`. `onCancel` should end the orchestrator's drag; it is called when the grid cancels
   * the drag, on Escape or a release outside the window.
   */
  public startDrag(gridItem: SceneGridItemLike, evt: PointerPress, info: GridItemDragInfo, onCancel: () => void) {
    const key = getLayoutKey(gridItem);
    const before = this.getLayout();
    const item = before.find((candidate) => candidate.i === key);
    if (!item || !gridItem.state.key || !this._container) {
      return;
    }

    const rect = pixelRectFor(this._container.clientWidth, item);
    this._startSession({
      kind: 'drag',
      key,
      gridItemKey: gridItem.state.key,
      isActive: false,
      preview: before,
      isOutside: false,
      startSize: { width: rect.width, height: rect.height },
      before,
      startX: evt.clientX,
      startY: evt.clientY,
      offsetX: info.offsetX,
      offsetY: info.offsetY,
      left: rect.left,
      top: rect.top,
      onCancel,
    });
  }

  public onDrag = (evt: PointerPosition) => {
    const session = this._session;
    if (session?.kind !== 'drag') {
      return;
    }
    // The release happened where the page could not see it, e.g. in another window
    if (evt.buttons === 0) {
      this._cancel();
      return;
    }

    if (!session.isActive) {
      if (Math.hypot(evt.clientX - session.startX, evt.clientY - session.startY) < DRAG_THRESHOLD_PX) {
        return;
      }
      document.body.classList.add('dragging-active');
    }

    const container = this._container;
    if (!container) {
      // The grid is not mounted mid-drag, e.g. because the drag switched to another tab
      this._updateSession({ isActive: true });
      return;
    }

    const rect = container.getBoundingClientRect();
    const left = evt.clientX - rect.left - session.offsetX;
    const top = evt.clientY - rect.top - session.offsetY;
    session.left = left;
    session.top = top;
    this._setDragPosition(left, top);

    const item = session.before.find((candidate) => candidate.i === session.key)!;
    const isOutside = this._isOverOtherDropTarget(evt.clientX, evt.clientY);
    let preview = session.preview;
    if (isOutside) {
      // The gap closes as soon as the item leaves the grid
      preview = session.isOutside ? preview : previewRemove(preview, session.key);
    } else {
      const cell = cellFromPixels(container.clientWidth, left, top, item.w, item.h);
      preview = session.isOutside
        ? previewInsert(preview, item, cell.x, cell.y)
        : previewMove(preview, session.key, cell.x, cell.y);
    }

    if (!session.isActive || isOutside !== session.isOutside || !isSameLayout(preview, session.preview)) {
      this._updateSession({ isActive: true, isOutside, preview });
    }
  };

  /**
   * Commits a drag that ended within the grid as one undoable move, with every item's position before
   * and after. Nothing happens if the drop does not change the layout or the item was dropped outside of
   * the grid, which cancels the move.
   */
  public commitDrag(gridItem: SceneGridItemLike) {
    const session = this._session;
    if (
      session?.kind !== 'drag' ||
      session.key !== getLayoutKey(gridItem) ||
      !session.isActive ||
      session.isOutside ||
      isSameLayout(session.preview, session.before)
    ) {
      return;
    }

    const gridItemState = this.getGridItem(session.key)?.state;
    const panel = gridItemState && 'body' in gridItemState ? gridItemState.body : undefined;
    if (!(panel instanceof VizPanel)) {
      return;
    }

    const { before, preview: after } = session;
    // Ended before the move is applied, so the grid renders the result straight away
    this._endSession();
    moveElement({
      meta: { actionId: 'panel.move', scope: 'custom-grid' },
      source: this.grid,
      movedObject: panel,
      // Same as other panel drops: moving panels should not take over the sidebar
      selectOnMove: false,
      perform: () => this.applyLayout(after),
      undo: () => this.applyLayout(before),
    });
  }

  /**
   * Positions of this grid's items before and after the dragged item leaves the grid, for a drop in
   * another layout. Applied on top of that move, so undo puts every item back.
   */
  public getDragSourceSnapshot(): LayoutSnapshot | null {
    const session = this._session;
    if (session?.kind !== 'drag') {
      return null;
    }
    const after = session.isOutside ? session.preview : previewRemove(session.preview, session.key);
    return { target: this, before: session.before, after };
  }

  /** Ends the drag in progress without changing anything */
  public endDrag = () => {
    if (this._session?.kind === 'drag') {
      this._endSession();
    }
  };

  /**
   * Previews a grid item dragged in from another layout where it would be dropped, live, at the cell
   * under the pointer. Items from another custom grid keep their size. Items from an auto grid get about
   * the size they were shown with: the same share of the row, and their height in grid rows.
   */
  public previewExternalDrag(gridItem: SceneGridItemLike, evt: PointerPosition, info: GridItemDragInfo) {
    const [cell] = gridItemsToLayout([gridItem]);
    const size = info.autoGrid
      ? autoGridItemSizeToGridSize(info, info.autoGrid)
      : { w: Math.min(Math.max(cell.w, 1), GRID_COLUMN_COUNT), h: Math.max(cell.h, 1) };
    this._previewExternalDrop(cell.i, size, evt, info);
  }

  /**
   * Previews a new panel from the Add pane where it would be dropped. The pointer holds the panel by the
   * middle of its top edge, like a panel is held by its header.
   */
  public previewNewPanelDrag(evt: PointerPosition, size: { w: number; h: number }) {
    const width = this._container ? pixelRectFor(this._container.clientWidth, { x: 0, y: 0, ...size }).width : 0;
    this._previewExternalDrop(NEW_PANEL_DROP_KEY, size, evt, { offsetX: width / 2, offsetY: NEW_PANEL_GRAB_TOP_PX });
  }

  /** Stops previewing an item from elsewhere, so the grid shows its own layout again */
  public endExternalDrop = () => {
    if (this._externalDrop) {
      this._externalDrop = null;
      this._publishInteraction();
    }
  };

  /**
   * Positions of this grid's items before and after the previewed grid item is dropped, for a drop from
   * another layout. Applied on top of that move, so the item lands where it was previewed and undo puts
   * every item back.
   */
  public getExternalDropSnapshot(): LayoutSnapshot | null {
    const drop = this._externalDrop;
    if (!drop || drop.key === NEW_PANEL_DROP_KEY) {
      return null;
    }
    return { target: this, before: drop.before, after: drop.preview };
  }

  /** Same as `getExternalDropSnapshot`, for the previewed new panel, which is added with the given key */
  public getNewPanelDropSnapshot(panelKey: string): LayoutSnapshot | null {
    const drop = this._externalDrop;
    if (drop?.key !== NEW_PANEL_DROP_KEY) {
      return null;
    }
    const after = drop.preview.map((item) => (item.i === NEW_PANEL_DROP_KEY ? { ...item, i: panelKey } : item));
    return { target: this, before: drop.before, after };
  }

  private _previewExternalDrop(
    key: string,
    size: { w: number; h: number },
    evt: Pick<PointerEvent, 'clientX' | 'clientY'>,
    grab: Pick<GridItemDragInfo, 'offsetX' | 'offsetY'>
  ) {
    const container = this._container;
    // Narrow grids show every item at full width in reading order, so there is no cell to preview
    if (!container || container.clientWidth <= NARROW_GRID_MAX_WIDTH || this._session) {
      this.endExternalDrop();
      return;
    }

    const containerWidth = container.clientWidth;
    const rect = container.getBoundingClientRect();
    const cell = cellFromPixels(
      containerWidth,
      evt.clientX - rect.left - grab.offsetX,
      evt.clientY - rect.top - grab.offsetY,
      size.w,
      size.h
    );

    const current = this._externalDrop?.key === key ? this._externalDrop : null;
    if (!current) {
      const before = this.getLayout();
      const { width, height } = pixelRectFor(containerWidth, { x: 0, y: 0, ...size });
      this._externalDrop = {
        key,
        before,
        preview: previewInsert(before, { i: key, x: 0, y: 0, ...size }, cell.x, cell.y),
        size: { width, height },
      };
      this._publishInteraction();
      return;
    }

    const preview = previewMove(current.preview, key, cell.x, cell.y);
    if (!isSameLayout(preview, current.preview)) {
      current.preview = preview;
      this._publishInteraction();
    }
  }

  /** Starts resizing a grid item from its bottom-right corner, until the pointer is released */
  public startResize = (
    evt: PointerPress & Pick<PointerEvent, 'preventDefault' | 'stopPropagation'>,
    gridItem: SceneGridItemLike
  ) => {
    const key = getLayoutKey(gridItem);
    const before = this.getLayout();
    const item = before.find((candidate) => candidate.i === key);
    const container = this._container;
    if (evt.button !== 0 || this._session || !item || !gridItem.state.key || !container) {
      return;
    }
    // Keeps the press from selecting text, or the panel under it
    evt.preventDefault();
    evt.stopPropagation();

    const rect = pixelRectFor(container.clientWidth, item);
    this._startSession({
      kind: 'resize',
      key,
      gridItemKey: gridItem.state.key,
      isActive: true,
      preview: before,
      isOutside: false,
      startSize: { width: rect.width, height: rect.height },
      before,
      startX: evt.clientX,
      startY: evt.clientY,
      offsetX: 0,
      offsetY: 0,
      left: rect.left,
      top: rect.top,
    });
    window.addEventListener('pointermove', this._onResizeMove);
    this._setResizeSize(rect.width, rect.height);
  };

  private _onResizeMove = (evt: PointerPosition) => {
    const session = this._session;
    const container = this._container;
    if (session?.kind !== 'resize' || !container) {
      return;
    }
    if (evt.buttons === 0) {
      this._cancel();
      return;
    }

    const containerWidth = container.clientWidth;
    // Like react-grid-layout, the item follows the pointer but is never smaller than one cell or wider than the grid
    const minSize = pixelRectFor(containerWidth, { x: 0, y: 0, w: 1, h: 1 });
    const width = Math.min(
      Math.max(session.startSize.width + evt.clientX - session.startX, minSize.width),
      containerWidth - session.left
    );
    const height = Math.max(session.startSize.height + evt.clientY - session.startY, minSize.height);
    this._setResizeSize(width, height);

    const item = session.preview.find((candidate) => candidate.i === session.key);
    if (!item) {
      return;
    }
    const { w, h } = sizeFromPixels(containerWidth, item, { width, height });
    const preview = previewResize(session.preview, session.key, w, h);
    if (!isSameLayout(preview, session.preview)) {
      this._updateSession({ preview });
    }
  };

  private _onResizeEnd() {
    const session = this._session;
    if (session?.kind !== 'resize') {
      return;
    }
    // react-grid-layout compacts once more when a resize ends
    const after = compact(session.preview);
    const { before } = session;
    this._endSession();
    if (isSameLayout(after, before)) {
      return;
    }

    edit({
      meta: { actionId: 'panel.resize', scope: 'custom-grid' },
      description: t('dashboard.edit-actions.resize-panel', 'Resize panel'),
      source: this.grid,
      perform: () => this.applyLayout(after),
      undo: () => this.applyLayout(before),
    });
  }

  private _onPointerUp = (evt: PointerEvent) => {
    const kind = this._session?.kind;
    if (kind === 'resize') {
      this._onResizeEnd();
    } else if (kind === 'drag' && isOutsidePage(evt)) {
      // The layout orchestrator does not see every such release, and nothing out there can take the panel
      this._cancel();
    }
  };

  private _onKeyDown = (evt: KeyboardEvent) => {
    if (evt.key !== 'Escape' || !this._session) {
      return;
    }
    // Only cancels the interaction, without also closing or leaving anything else
    evt.preventDefault();
    evt.stopPropagation();
    this._cancel();
  };

  private _onPointerCancel = () => this._cancel();

  /** Ends the interaction in progress without changing the layout */
  private _cancel() {
    const onCancel = this._session?.onCancel;
    this._endSession();
    onCancel?.();
  }

  private _startSession(session: Session) {
    this._session = session;
    window.addEventListener('pointerup', this._onPointerUp, true);
    window.addEventListener('pointercancel', this._onPointerCancel, true);
    window.addEventListener('keydown', this._onKeyDown, true);
    document.body.classList.add('dashboard-draggable-transparent-selection');
    this._publishInteraction();
  }

  private _updateSession(update: Partial<Session>) {
    if (this._session) {
      Object.assign(this._session, update);
      this._publishInteraction();
    }
  }

  private _endSession() {
    if (!this._session) {
      return;
    }
    this._session = null;
    window.removeEventListener('pointermove', this._onResizeMove);
    window.removeEventListener('pointerup', this._onPointerUp, true);
    window.removeEventListener('pointercancel', this._onPointerCancel, true);
    window.removeEventListener('keydown', this._onKeyDown, true);
    document.body.classList.remove('dashboard-draggable-transparent-selection', 'dragging-active');
    window.getSelection()?.removeAllRanges();
    this._publishInteraction();
  }

  private _publishInteraction() {
    const session = this._session;
    const drop = this._externalDrop;
    if (session) {
      this._interaction = {
        kind: session.kind,
        key: session.key,
        isActive: session.isActive,
        preview: session.preview,
        isOutside: session.isOutside,
        startSize: session.startSize,
      };
    } else if (drop) {
      this._interaction = {
        kind: 'drop',
        key: drop.key,
        isActive: true,
        preview: drop.preview,
        isOutside: false,
        startSize: drop.size,
      };
    } else {
      this._interaction = null;
    }
    this._notify();
  }

  /**
   * Whether the pointer is over a drop target other than this grid, where the layout orchestrator would
   * drop the item. The first drop target under the pointer is the innermost one. The row or tab right
   * around the grid counts as the grid, like for the layout orchestrator: a drop on its header or empty
   * area lands in the grid.
   */
  private _isOverOtherDropTarget(clientX: number, clientY: number): boolean {
    const container = this._container;
    const dropTarget = document
      .elementsFromPoint(clientX, clientY)
      .find((element) => element.hasAttribute(DASHBOARD_DROP_TARGET_KEY_ATTR));
    const section = container?.parentElement?.closest(`[${DASHBOARD_DROP_TARGET_KEY_ATTR}]`);
    return !!dropTarget && dropTarget !== container && dropTarget !== section;
  }

  private _setDragPosition(left: number, top: number) {
    const element = this._getItemElement();
    element?.style.setProperty(DRAG_LEFT_VAR, `${left}px`);
    element?.style.setProperty(DRAG_TOP_VAR, `${top}px`);
  }

  private _setResizeSize(width: number, height: number) {
    const element = this._getItemElement();
    element?.style.setProperty(RESIZE_WIDTH_VAR, `${width}px`);
    element?.style.setProperty(RESIZE_HEIGHT_VAR, `${height}px`);
  }

  private _getItemElement(): HTMLElement | null {
    const key = this._session?.gridItemKey;
    if (!key || !this._container) {
      return null;
    }
    const element = Array.from(this._container.children).find(
      (child) => child.getAttribute(GRID_ITEM_KEY_ATTR) === key
    );
    return element instanceof HTMLElement ? element : null;
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

/** Whether a pointer event happened outside the page, e.g. outside the window, where nothing can take a dragged panel */
export function isOutsidePage({
  clientX,
  clientY,
  target,
}: Pick<PointerEvent, 'clientX' | 'clientY' | 'target'>): boolean {
  const isOutsideWindow = clientX < 0 || clientY < 0 || clientX > window.innerWidth || clientY > window.innerHeight;
  return isOutsideWindow || !(target instanceof Node && document.body.contains(target));
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
