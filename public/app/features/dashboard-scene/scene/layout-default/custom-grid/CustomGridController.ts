import { type PointerEvent as ReactPointerEvent } from 'react';
import { type Layout, type LayoutItem } from 'react-grid-layout-v2/core';

import { t } from '@grafana/i18n';
import { type SceneGridItemLike, type SceneGridLayout, type SceneObject, VizPanel } from '@grafana/scenes';

import { moveElement } from '../../../actions/element/moveElement';
import { edit } from '../../../actions/utils/edit';
import { DashboardGridItem } from '../DashboardGridItem';

import {
  cellFromPixels,
  compact,
  isSameLayout,
  pixelRectFor,
  previewInsert,
  previewMove,
  previewRemove,
  previewResize,
  sizeFromPixels,
} from './gridMath';

/** Size and grab offset of the dragged item, captured when the drag starts */
export interface GridItemDragInfo {
  /** Offset from the pointer to the item's top-left corner */
  offsetX: number;
  offsetY: number;
  /** Size the item gets in a custom grid */
  gridSize: { w: number; h: number };
}

export interface LayoutSnapshot {
  target: { applyLayout(layout: Layout): void };
  before: Layout;
  after: Layout;
}

export interface CustomGridViewState {
  /** Layout rendered instead of the committed one while an interaction is in progress */
  preview: LayoutItem[] | null;
  /** Panel key of this grid's item being dragged. It stays mounted here and follows the pointer. */
  draggingKey: string | null;
  /** Pixel size of the dragged item */
  draggingSize: { width: number; height: number } | null;
  /** Panel key of the item a placeholder is shown for, if any */
  placeholderKey: string | null;
  /** Panel key of the item being resized */
  resizingKey: string | null;
  isDropTarget: boolean;
}

const DRAG_THRESHOLD_PX = 4;

export const DRAG_LEFT_VAR = '--custom-grid-drag-left';
export const DRAG_TOP_VAR = '--custom-grid-drag-top';
export const RESIZE_WIDTH_VAR = '--custom-grid-resize-width';
export const RESIZE_HEIGHT_VAR = '--custom-grid-resize-height';

const initialViewState: CustomGridViewState = {
  preview: null,
  draggingKey: null,
  draggingSize: null,
  placeholderKey: null,
  resizingKey: null,
  isDropTarget: false,
};

interface OwnDrag {
  key: string;
  gridItemKey: string;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  isActive: boolean;
  isInside: boolean;
  lastCell: string | null;
  startLayout: LayoutItem[];
}

interface ForeignDrag {
  key: string;
  lastCell: string | null;
}

interface Resize {
  key: string;
  gridItemKey: string;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  lastSize: string;
  startLayout: LayoutItem[];
}

/** Layout items are keyed by panel key since panels keep their key when moved between grid item types */
export function getPanelKey(gridItem: SceneGridItemLike): string | undefined {
  if ('body' in gridItem.state && gridItem.state.body instanceof VizPanel) {
    return gridItem.state.body.state.key;
  }
  return undefined;
}

/**
 * Owns all interaction state of one custom grid: dragging its own items, previewing items dragged
 * in from other layouts, and resizing. The scene state is only changed when an interaction is
 * committed; until then the renderer draws `preview`.
 */
export class CustomGridController {
  private _view: CustomGridViewState = initialViewState;
  private _listeners = new Set<() => void>();
  private _container: HTMLElement | null = null;
  private _ownDrag: OwnDrag | null = null;
  private _foreignDrag: ForeignDrag | null = null;
  private _resize: Resize | null = null;
  private _lastSourceSnapshot: LayoutSnapshot | null = null;

  public constructor(
    private readonly _grid: SceneGridLayout,
    private readonly _editSource: SceneObject
  ) {}

  public subscribe = (listener: () => void) => {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  };

  public getViewState = () => this._view;

  public setContainer = (el: HTMLElement | null) => {
    this._container = el;
  };

  public getCommittedLayout(): LayoutItem[] {
    const layout: LayoutItem[] = [];
    for (const child of this._grid.state.children) {
      const key = getPanelKey(child);
      if (!key) {
        continue;
      }
      layout.push({
        i: key,
        x: child.state.x ?? 0,
        y: child.state.y ?? 0,
        w: child.state.width ?? 1,
        h: child.state.height ?? 1,
      });
    }
    return compact(layout);
  }

  public applyLayout = (layout: Layout) => {
    const byKey = new Map(layout.map((item) => [item.i, item]));

    for (const child of this._grid.state.children) {
      const key = getPanelKey(child);
      const item = key ? byKey.get(key) : undefined;
      if (!item) {
        continue;
      }
      const { x, y, width, height } = child.state;
      if (x === item.x && y === item.y && width === item.w && height === item.h) {
        continue;
      }
      const isRepeat = child instanceof DashboardGridItem && !!child.state.variableName;
      child.setState({
        x: item.x,
        y: item.y,
        width: item.w,
        height: item.h,
        ...(child instanceof DashboardGridItem && !isRepeat ? { itemHeight: item.h } : {}),
      });
    }

    this._grid.setState({
      children: [...this._grid.state.children].sort((a, b) => a.state.y! - b.state.y! || a.state.x! - b.state.x!),
    });
  };

  // ---------------------------------------------------------------------------
  // Dragging an item that lives in this grid
  // ---------------------------------------------------------------------------

  public startItemDrag(evt: ReactPointerEvent, gridItem: SceneGridItemLike) {
    const key = getPanelKey(gridItem);
    const itemEl = this._getItemElement(gridItem);
    if (!key || !itemEl || !this._container) {
      return;
    }

    const itemRect = itemEl.getBoundingClientRect();
    this._ownDrag = {
      key,
      gridItemKey: gridItem.state.key!,
      startX: evt.clientX,
      startY: evt.clientY,
      offsetX: evt.clientX - itemRect.left,
      offsetY: evt.clientY - itemRect.top,
      isActive: false,
      isInside: true,
      lastCell: null,
      startLayout: this.getCommittedLayout(),
    };
    this._lastSourceSnapshot = null;
  }

  public onItemDrag = (evt: PointerEvent) => {
    const drag = this._ownDrag;
    if (!drag) {
      return;
    }

    if (!drag.isActive) {
      if (Math.hypot(evt.clientX - drag.startX, evt.clientY - drag.startY) < DRAG_THRESHOLD_PX) {
        return;
      }
      drag.isActive = true;
      const item = drag.startLayout.find((i) => i.i === drag.key);
      const size = item && this._container ? pixelRectFor(this._container.clientWidth, item) : null;
      document.body.classList.add('dashboard-draggable-transparent-selection', 'dragging-active');
      this._setView({
        preview: drag.startLayout,
        draggingKey: drag.key,
        draggingSize: size ? { width: size.width, height: size.height } : null,
        placeholderKey: drag.key,
      });
    }

    const container = this._container;
    if (!container) {
      // The grid got unmounted mid-drag (e.g. its tab was switched away), nothing to preview
      return;
    }

    const rect = container.getBoundingClientRect();
    const left = evt.clientX - rect.left - drag.offsetX;
    const top = evt.clientY - rect.top - drag.offsetY;
    // Set on the dragged item itself: custom properties inherit, so setting them on the grid would
    // invalidate the styles of every panel in it on each pointer move
    const itemEl = this._getItemElementByKey(drag.gridItemKey);
    itemEl?.style.setProperty(DRAG_LEFT_VAR, `${left}px`);
    itemEl?.style.setProperty(DRAG_TOP_VAR, `${top}px`);

    const isInside =
      evt.clientX >= rect.left && evt.clientX <= rect.right && evt.clientY >= rect.top && evt.clientY <= rect.bottom;
    const current = this._view.preview ?? drag.startLayout;

    if (!isInside) {
      if (drag.isInside) {
        drag.isInside = false;
        drag.lastCell = null;
        // Close the gap as soon as the item leaves the grid
        this._setView({ preview: previewRemove(current, drag.key), placeholderKey: null });
      }
      return;
    }

    const item = drag.startLayout.find((i) => i.i === drag.key)!;
    const cell = cellFromPixels(rect.width, left, top, item.w, item.h);
    const cellKey = `${cell.x}:${cell.y}`;

    if (!drag.isInside) {
      drag.isInside = true;
      drag.lastCell = cellKey;
      this._setView({ preview: previewInsert(current, item, cell.x, cell.y), placeholderKey: drag.key });
      return;
    }

    if (cellKey !== drag.lastCell) {
      drag.lastCell = cellKey;
      this._setView({ preview: previewMove(current, drag.key, cell.x, cell.y) });
    }
  };

  /** Commits a drag that ended within this grid. Dropping outside of it cancels the move. */
  public commitDragWithin() {
    const drag = this._ownDrag;
    const preview = this._view.preview;
    if (!drag || !drag.isActive || !drag.isInside || !preview || isSameLayout(preview, drag.startLayout)) {
      return;
    }
    const gridItem = this._findGridItem(drag.key);
    if (!(gridItem instanceof DashboardGridItem)) {
      return;
    }

    const before = drag.startLayout;
    const after = preview;

    moveElement({
      meta: { actionId: 'panel.moveOrResize', scope: 'move' },
      source: this._editSource,
      movedObject: gridItem.state.body,
      selectOnMove: false,
      perform: () => this.applyLayout(after),
      undo: () => this.applyLayout(before),
    });
  }

  /** Snapshot for moving the dragged item out of this grid: the gap it leaves behind is closed. */
  public getSourceSnapshot(): LayoutSnapshot | null {
    const drag = this._ownDrag;
    if (!drag) {
      return this._lastSourceSnapshot;
    }
    return {
      target: this,
      before: drag.startLayout,
      after: previewRemove(drag.startLayout, drag.key),
    };
  }

  public endItemDrag = () => {
    // Keep the snapshot around, the orchestrator may read it after the drag ended
    this._lastSourceSnapshot = this.getSourceSnapshot();
    // The drag position variables are left on the item on purpose: the item still references them
    // until React re-renders it at its slot, and removing them first makes it jump to the grid's
    // origin and animate in from there. Left in place, it animates from where it was dropped.
    this._ownDrag = null;
    document.body.classList.remove('dashboard-draggable-transparent-selection', 'dragging-active');
    this._setView({ preview: null, draggingKey: null, draggingSize: null, placeholderKey: null });
  };

  // ---------------------------------------------------------------------------
  // Items dragged in from other layouts
  // ---------------------------------------------------------------------------

  public onForeignDrag(gridItem: SceneGridItemLike, evt: PointerEvent, info: GridItemDragInfo) {
    const key = getPanelKey(gridItem);
    const container = this._container;
    if (!key || !container) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const left = evt.clientX - rect.left - info.offsetX;
    const top = evt.clientY - rect.top - info.offsetY;
    const { w, h } = info.gridSize;
    const cell = cellFromPixels(rect.width, left, top, w, h);
    const cellKey = `${cell.x}:${cell.y}`;

    if (!this._foreignDrag || this._foreignDrag.key !== key) {
      this._foreignDrag = { key, lastCell: cellKey };
      const item = { i: key, x: cell.x, y: cell.y, w, h };
      this._setView({ preview: previewInsert(this.getCommittedLayout(), item, cell.x, cell.y), placeholderKey: key });
      return;
    }

    if (cellKey !== this._foreignDrag.lastCell && this._view.preview) {
      this._foreignDrag.lastCell = cellKey;
      this._setView({ preview: previewMove(this._view.preview, key, cell.x, cell.y) });
    }
  }

  public clearForeignDrag() {
    if (!this._foreignDrag) {
      return;
    }
    this._foreignDrag = null;
    this._setView({ preview: null, placeholderKey: null });
  }

  /** Snapshot for dropping the foreign item into this grid, exactly where the preview shows it */
  public getDestinationSnapshot(): LayoutSnapshot | null {
    if (!this._foreignDrag || !this._view.preview) {
      return null;
    }
    return { target: this, before: this.getCommittedLayout(), after: this._view.preview };
  }

  public setIsDropTarget(isDropTarget: boolean) {
    if (this._view.isDropTarget !== isDropTarget) {
      this._setView({ isDropTarget });
    }
  }

  // ---------------------------------------------------------------------------
  // Resizing
  // ---------------------------------------------------------------------------

  public startResize(evt: ReactPointerEvent, gridItem: SceneGridItemLike) {
    const key = getPanelKey(gridItem);
    const itemEl = this._getItemElement(gridItem);
    if (!key || !itemEl) {
      return;
    }

    evt.preventDefault();
    evt.stopPropagation();

    const rect = itemEl.getBoundingClientRect();
    const startLayout = this.getCommittedLayout();
    const item = startLayout.find((i) => i.i === key);
    this._resize = {
      key,
      gridItemKey: gridItem.state.key!,
      startX: evt.clientX,
      startY: evt.clientY,
      startWidth: rect.width,
      startHeight: rect.height,
      lastSize: item ? `${item.w}:${item.h}` : '',
      startLayout,
    };

    itemEl.style.setProperty(RESIZE_WIDTH_VAR, `${rect.width}px`);
    itemEl.style.setProperty(RESIZE_HEIGHT_VAR, `${rect.height}px`);
    document.body.classList.add('dashboard-draggable-transparent-selection');
    window.addEventListener('pointermove', this._onResizeMove);
    window.addEventListener('pointerup', this._onResizeEnd, true);
    this._setView({ preview: startLayout, resizingKey: key, placeholderKey: key });
  }

  private _onResizeMove = (evt: PointerEvent) => {
    const resize = this._resize;
    const container = this._container;
    const preview = this._view.preview;
    if (!resize || !container || !preview) {
      return;
    }

    const width = Math.max(resize.startWidth + evt.clientX - resize.startX, 20);
    const height = Math.max(resize.startHeight + evt.clientY - resize.startY, 20);
    const itemEl = this._getItemElementByKey(resize.gridItemKey);
    itemEl?.style.setProperty(RESIZE_WIDTH_VAR, `${width}px`);
    itemEl?.style.setProperty(RESIZE_HEIGHT_VAR, `${height}px`);

    const item = preview.find((i) => i.i === resize.key);
    if (!item) {
      return;
    }
    const { w, h } = sizeFromPixels(container.clientWidth, width, height, item.x, item.y);
    const sizeKey = `${w}:${h}`;
    if (sizeKey !== resize.lastSize) {
      resize.lastSize = sizeKey;
      this._setView({ preview: previewResize(preview, resize.key, w, h) });
    }
  };

  private _onResizeEnd = () => {
    window.removeEventListener('pointermove', this._onResizeMove);
    window.removeEventListener('pointerup', this._onResizeEnd, true);
    document.body.classList.remove('dashboard-draggable-transparent-selection');

    const resize = this._resize;
    const preview = this._view.preview;
    // Like the drag position, the resize size variables stay until the next resize overwrites them,
    // so the item animates from its resized size to its slot instead of collapsing first
    this._resize = null;
    this._setView({ preview: null, resizingKey: null, placeholderKey: null });

    if (!resize || !preview || isSameLayout(preview, resize.startLayout)) {
      return;
    }

    const before = resize.startLayout;
    const after = preview;
    edit({
      meta: { actionId: 'panel.moveOrResize', scope: 'resize' },
      description: t('dashboard.custom-grid.resize-panel', 'Resize panel'),
      source: this._editSource,
      perform: () => this.applyLayout(after),
      undo: () => this.applyLayout(before),
    });
  };

  public deactivate() {
    window.removeEventListener('pointermove', this._onResizeMove);
    window.removeEventListener('pointerup', this._onResizeEnd, true);
    this._ownDrag = null;
    this._foreignDrag = null;
    this._resize = null;
    this._view = initialViewState;
  }

  private _findGridItem(key: string): SceneGridItemLike | undefined {
    return this._grid.state.children.find((child) => getPanelKey(child) === key);
  }

  private _getItemElement(gridItem: SceneGridItemLike): HTMLElement | null {
    return gridItem.state.key ? this._getItemElementByKey(gridItem.state.key) : null;
  }

  private _getItemElementByKey(gridItemKey: string): HTMLElement | null {
    return this._container?.querySelector<HTMLElement>(`:scope > [data-griditem-key="${gridItemKey}"]`) ?? null;
  }

  private _setView(update: Partial<CustomGridViewState>) {
    this._view = { ...this._view, ...update };
    this._listeners.forEach((listener) => listener());
  }
}
