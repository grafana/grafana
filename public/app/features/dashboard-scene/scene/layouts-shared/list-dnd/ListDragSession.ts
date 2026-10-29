import { RowsLayoutManager } from '../../layout-rows/RowsLayoutManager';
import { TabItem } from '../../layout-tabs/TabItem';

import { commitListDrop } from './commitListDrop';
import { getListOf, isSameListDropTarget, type ListDropTarget, type ListItem, type ListLayout } from './listDnd';

/** How far the pointer has to move before a press on a row or tab header becomes a drag */
const DRAG_THRESHOLD_PX = 4;
/** Used when the header can't be measured */
const FALLBACK_HEADER_HEIGHT = 40;
const FALLBACK_TAB_WIDTH = 120;

export interface ListDragState {
  itemKey: string;
  sourceListKey: string;
  /** Where the item goes when it's dropped now, if anywhere */
  target: ListDropTarget | null;
  /** Height of the dragged item's header: rows can be very tall, so other lists show a header-sized placeholder */
  placeholderHeight: number;
  /** Width of the dragged item's header, for the placeholder in a tab bar */
  placeholderWidth: number;
}

/** Floating preview of the dragged item's header, positioned so the pointer keeps its grab point */
export interface ListDragPreview {
  type: 'row' | 'tab';
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

/** What the session needs from the layout orchestrator that starts it */
export interface ListDragHost {
  /** Where the item would land if it were dropped at this point */
  getDropTarget(x: number, y: number): ListDropTarget | null;
  /** Each pointer move of the drag, for hovering tabs open */
  onDragMove(x: number, y: number): void;
  showPreview(preview: ListDragPreview): void;
  movePreview(x: number, y: number): void;
  /** The state returned by `getState` changed */
  onChange(): void;
  /** The session is over, after a drop or a cancel. Called once. */
  onEnd(): void;
}

interface PointerPress {
  button: number;
  clientX: number;
  clientY: number;
  target: EventTarget | null;
}

/**
 * Dragging a row or a tab, from a press on its header to the drop. The item stays in its list until the drop,
 * renderers show it moving through `getState`: the source list renders the item where it would be
 * dropped, other lists render a placeholder. Every drop is one undoable action.
 *
 * Escape, a release outside the window and a cancelled pointer end the drag without changing anything.
 */
export class ListDragSession {
  private _state: ListDragState | null = null;
  private _isOver = false;

  private constructor(
    private readonly _item: ListItem,
    private readonly _sourceList: ListLayout,
    private readonly _start: { x: number; y: number },
    private readonly _host: ListDragHost
  ) {}

  /** Starts a session for a press on the item's drag handle, or returns null if the press doesn't start one */
  public static start(evt: PointerPress, item: ListItem, host: ListDragHost): ListDragSession | null {
    const sourceList = getListOf(item);
    if (!sourceList || evt.button !== 0 || isInteractiveTarget(evt.target, item)) {
      return null;
    }

    const session = new ListDragSession(item, sourceList, { x: evt.clientX, y: evt.clientY }, host);
    window.addEventListener('pointermove', session._onPointerMove, true);
    // Capture phase: tab headers stop the propagation of pointerup
    window.addEventListener('pointerup', session._onPointerUp, true);
    window.addEventListener('pointercancel', session._onPointerCancel, true);
    window.addEventListener('keydown', session._onKeyDown, true);
    return session;
  }

  /** Null until the pointer has moved far enough to start dragging */
  public getState(): ListDragState | null {
    return this._state;
  }

  public isActive(): boolean {
    return this._state !== null;
  }

  /** Ends the session without dropping the item */
  public cancel(): void {
    this._end();
  }

  private _onPointerMove = (evt: PointerEvent) => {
    // No button pressed means the release happened outside the window
    if (evt.buttons === 0) {
      this._end();
      return;
    }

    if (!this._state) {
      if (Math.hypot(evt.clientX - this._start.x, evt.clientY - this._start.y) < DRAG_THRESHOLD_PX) {
        return;
      }
      this._activate();
    }

    this._host.movePreview(evt.clientX, evt.clientY);
    this._host.onDragMove(evt.clientX, evt.clientY);
    this._setTarget(this._host.getDropTarget(evt.clientX, evt.clientY));
  };

  private _onPointerUp = (evt: PointerEvent) => {
    if (!this._state || isOutsideWindow(evt)) {
      this._end();
      return;
    }

    // Pointer moves can be coalesced, so the release point decides
    const target = this._host.getDropTarget(evt.clientX, evt.clientY);
    this._end();
    if (this._item instanceof TabItem) {
      suppressNextClick();
    }
    if (target) {
      commitListDrop(this._item, this._sourceList, target);
    }
  };

  private _onPointerCancel = () => this._end();

  private _onKeyDown = (evt: KeyboardEvent) => {
    if (evt.key !== 'Escape' || !this._state) {
      return;
    }
    // Only cancels the drag, without also closing or leaving anything else
    evt.preventDefault();
    evt.stopPropagation();
    this._end();
  };

  private _activate() {
    const isTab = this._item instanceof TabItem;
    const { label, width, height, offsetX, offsetY } = this._measureItem(isTab);
    this._state = {
      itemKey: this._item.state.key!,
      sourceListKey: this._sourceList.state.key!,
      target: null,
      placeholderHeight: height,
      placeholderWidth: width,
    };
    // Same as when a drag starts on the old path, which selects rows but not tabs
    if (this._sourceList instanceof RowsLayoutManager) {
      this._sourceList.forceSelectRow(this._item.state.key!);
    }
    this._host.showPreview({
      type: isTab ? 'tab' : 'row',
      label,
      x: this._start.x,
      y: this._start.y,
      width,
      height,
      offsetX,
      offsetY,
    });
    this._host.onChange();
  }

  /** The header of the item: the element of a tab is its header, a row's header is the top of the row */
  private _measureItem(isTab: boolean) {
    const element = this._item.containerRef.current;
    const itemRect = element?.getBoundingClientRect();
    const headerRect = isTab
      ? itemRect
      : (element?.querySelector(':scope > .dashboard-row-header')?.getBoundingClientRect() ?? itemRect);
    const width = itemRect?.width || (isTab ? FALLBACK_TAB_WIDTH : 400);
    const height = headerRect?.height || FALLBACK_HEADER_HEIGHT;
    return {
      label: this._item.state.title || (isTab ? 'Tab' : 'Row'),
      width,
      height,
      offsetX: headerRect ? clamp(this._start.x - headerRect.left, 0, width) : 20,
      offsetY: headerRect ? clamp(this._start.y - headerRect.top, 0, height) : 20,
    };
  }

  private _setTarget(target: ListDropTarget | null) {
    const state = this._state;
    if (!state || isSameListDropTarget(state.target, target)) {
      return;
    }
    setTabHighlight(state.target, false);
    setTabHighlight(target, true);
    this._state = { ...state, target };
    this._host.onChange();
  }

  private _end() {
    if (this._isOver) {
      return;
    }
    this._isOver = true;
    window.removeEventListener('pointermove', this._onPointerMove, true);
    window.removeEventListener('pointerup', this._onPointerUp, true);
    window.removeEventListener('pointercancel', this._onPointerCancel, true);
    window.removeEventListener('keydown', this._onKeyDown, true);

    const wasActive = this._state !== null;
    setTabHighlight(this._state?.target ?? null, false);
    this._state = null;
    if (wasActive) {
      this._host.onChange();
    }
    this._host.onEnd();
  }
}

/** A tab target may be a tab that isn't open, its header is all there is to highlight */
function setTabHighlight(target: ListDropTarget | null, isHighlighted: boolean) {
  if (target?.kind === 'tab') {
    target.tab.setIsDropTarget(isHighlighted);
  }
}

/** Presses on controls inside a header don't start a drag. A tab header is a link itself, so that one does. */
function isInteractiveTarget(target: EventTarget | null, item: ListItem): boolean {
  const control =
    target instanceof Element ? target.closest('button, input, textarea, select, a[href], [role="button"]') : null;
  return !!control && !(item instanceof TabItem && control.getAttribute('role') === 'tab');
}

/**
 * A tab dropped where it started, or reordered under the pointer, gets the click of the release, which
 * would open it. The click comes right after the pointerup.
 */
function suppressNextClick() {
  const onClick = (evt: MouseEvent) => {
    evt.preventDefault();
    evt.stopPropagation();
  };
  window.addEventListener('click', onClick, { capture: true, once: true });
  setTimeout(() => window.removeEventListener('click', onClick, { capture: true }), 0);
}

function isOutsideWindow({ clientX, clientY }: { clientX: number; clientY: number }): boolean {
  return clientX < 0 || clientY < 0 || clientX > window.innerWidth || clientY > window.innerHeight;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
