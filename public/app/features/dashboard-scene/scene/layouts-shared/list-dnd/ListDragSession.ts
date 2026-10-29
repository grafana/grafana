import { commitListDrop } from './commitListDrop';
import { getListOf, isSameListDropTarget, type ListDropTarget, type ListItem, type ListLayout } from './listDnd';

/** How far the pointer has to move before a press on a row header becomes a drag */
const DRAG_THRESHOLD_PX = 4;
/** Used when the row header can't be measured */
const FALLBACK_HEADER_HEIGHT = 40;

export interface ListDragState {
  itemKey: string;
  sourceListKey: string;
  /** Where the item goes when it's dropped now, if anywhere */
  target: ListDropTarget | null;
  /** Height of the dragged item's header: rows can be very tall, so other lists show a header-sized placeholder */
  placeholderHeight: number;
}

/** Floating preview of the dragged item's header, positioned so the pointer keeps its grab point */
export interface ListDragPreview {
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
 * Dragging a row, from a press on its header to the drop. The item stays in its list until the drop,
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
    if (!sourceList || evt.button !== 0 || isInteractiveTarget(evt.target)) {
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
    const { label, width, height, offsetX, offsetY } = this._measureItem();
    this._state = {
      itemKey: this._item.state.key!,
      sourceListKey: this._sourceList.state.key!,
      target: null,
      placeholderHeight: height,
    };
    // Same as when a drag starts on the old path
    this._sourceList.forceSelectRow(this._item.state.key!);
    this._host.showPreview({ label, x: this._start.x, y: this._start.y, width, height, offsetX, offsetY });
    this._host.onChange();
  }

  private _measureItem() {
    const element = this._item.containerRef.current;
    const itemRect = element?.getBoundingClientRect();
    const headerRect = element?.querySelector(':scope > .dashboard-row-header')?.getBoundingClientRect() ?? itemRect;
    const width = itemRect?.width || 400;
    const height = headerRect?.height || FALLBACK_HEADER_HEIGHT;
    return {
      label: this._item.state.title || 'Row',
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

/** Presses on controls inside a header don't start a drag */
function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('button, input, textarea, select, a[href], [role="button"]');
}

function isOutsideWindow({ clientX, clientY }: { clientX: number; clientY: number }): boolean {
  return clientX < 0 || clientY < 0 || clientX > window.innerWidth || clientY > window.innerHeight;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
