import { isOutsidePage } from '../layout-default/custom-grid/CustomGridController';

export interface AutoGridDragSessionHost {
  /** The grid container while the grid is rendered */
  getContainer(): HTMLElement | null;
  /**
   * Puts the dragged panel back under the pointer, after the grid moved on the page or was rendered again.
   * A new container has lost the panel's size as well.
   */
  followPointer(isNewContainer: boolean): void;
  /** Ends the drag without changing anything */
  cancel(): void;
}

/**
 * The auto grid's part of a panel drag on the unified drag and drop engine. It tells whether the pointer is
 * outside the grid, where the panel must not take up a cell any more. It keeps the floating panel under the
 * pointer when the page shifts while the pointer rests, e.g. when the gap closes or another layout previews
 * the drop. It cancels the drag on Escape and on a release outside the window, which the layout orchestrator
 * does not see.
 */
export class AutoGridDragSession {
  private _frame: number | null = null;
  private _container: HTMLElement | null = null;
  private _top = 0;
  private _left = 0;

  public constructor(private readonly _host: AutoGridDragSessionHost) {}

  public start() {
    window.addEventListener('pointerup', this._onPointerUp, true);
    window.addEventListener('pointercancel', this._onPointerCancel, true);
    window.addEventListener('keydown', this._onKeyDown, true);
    this._frame = requestAnimationFrame(this._onFrame);
  }

  public stop() {
    window.removeEventListener('pointerup', this._onPointerUp, true);
    window.removeEventListener('pointercancel', this._onPointerCancel, true);
    window.removeEventListener('keydown', this._onKeyDown, true);
    if (this._frame !== null) {
      cancelAnimationFrame(this._frame);
      this._frame = null;
    }
  }

  /** Whether the point is outside the grid. Also true while the grid is not rendered, e.g. in a hidden tab. */
  public isOutside(clientX: number, clientY: number): boolean {
    const container = this._host.getContainer();
    if (!container) {
      return true;
    }
    const rect = container.getBoundingClientRect();
    return clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom;
  }

  // Layout shifts don't fire pointer moves, so the grid's position is checked once per frame
  private _onFrame = () => {
    this._frame = requestAnimationFrame(this._onFrame);
    const container = this._host.getContainer();
    if (!container) {
      this._container = null;
      return;
    }
    const { top, left } = container.getBoundingClientRect();
    const isNewContainer = container !== this._container;
    if (isNewContainer || top !== this._top || left !== this._left) {
      this._container = container;
      this._top = top;
      this._left = left;
      this._host.followPointer(isNewContainer);
    }
  };

  private _onPointerUp = (evt: PointerEvent) => {
    if (isOutsidePage(evt)) {
      this._host.cancel();
    }
  };

  private _onPointerCancel = () => this._host.cancel();

  private _onKeyDown = (evt: KeyboardEvent) => {
    if (evt.key !== 'Escape') {
      return;
    }
    // Only cancels the drag, without also closing or leaving anything else
    evt.preventDefault();
    evt.stopPropagation();
    this._host.cancel();
  };
}
