import { PointerEvent as ReactPointerEvent } from 'react';

import { logWarning } from '@grafana/runtime';
import {
  sceneGraph,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  VizPanel,
  SceneGridItemLike,
} from '@grafana/scenes';
import { createPointerDistance } from '@grafana/ui';

import { DashboardScene } from './DashboardScene';
import { DashboardLayoutGrid, isDashboardLayoutGrid } from './types/DashboardLayoutGrid';
import { isDashboardLayoutManager } from './types/DashboardLayoutManager';

interface DashboardLayoutOrchestratorState extends SceneObjectState {
  draggingGridItem?: SceneObjectRef<SceneGridItemLike>;
}

export class DashboardLayoutOrchestrator extends SceneObjectBase<DashboardLayoutOrchestratorState> {
  private _sourceGrid: DashboardLayoutGrid | null = null;
  private _lastGrid: DashboardLayoutGrid | null = null;
  private _pointerDistance = createPointerDistance();
  private _isSelectedObject = false;

  public constructor() {
    super({});

    this._onPointerMove = this._onPointerMove.bind(this);
    this._stopDraggingSync = this._stopDraggingSync.bind(this);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    return () => {
      document.body.removeEventListener('pointermove', this._onPointerMove);
      document.body.removeEventListener('pointerup', this._stopDraggingSync);
    };
  }

  public startDraggingSync(evt: ReactPointerEvent, gridItem: SceneGridItemLike, layoutGrid: DashboardLayoutGrid): void {
    this._pointerDistance.set(evt);
    this._isSelectedObject = false;

    (sceneGraph.findAllObjects(
      this._getDashboard(),
      (obj) => isDashboardLayoutManager(obj) && isDashboardLayoutGrid(obj)
    ) as DashboardLayoutGrid[]).forEach((layout) => layout.startOrchestratorSync?.());

    this._sourceGrid = layoutGrid;
    this._lastGrid = layoutGrid;

    document.body.addEventListener('pointermove', this._onPointerMove);
    document.body.addEventListener('pointerup', this._stopDraggingSync);

    this.setState({ draggingGridItem: gridItem.getRef() });
  }

  private _stopDraggingSync(_evt: PointerEvent) {
    const gridItem = this.state.draggingGridItem?.resolve();

    if (this._sourceGrid !== this._lastGrid) {
      // Wrapped in setTimeout to ensure that any event handlers are called
      // Useful for allowing react-grid-layout to remove placeholders, etc.
      setTimeout(() => {
        if (gridItem) {
          // Always use grid item dragging
          this._sourceGrid?.draggedItemOutside?.(gridItem);
          this._lastGrid?.draggedItemInside?.(gridItem);
        } else {
          const warningMessage = 'No grid item to drag';
          console.warn(warningMessage);
          logWarning(warningMessage);
        }
      });
    }

    document.body.removeEventListener('pointermove', this._onPointerMove);
    document.body.removeEventListener('pointerup', this._stopDraggingSync);

    this.setState({ draggingGridItem: undefined });
  }

  private _onPointerMove(evt: PointerEvent) {
    if (!this._isSelectedObject && this.state.draggingGridItem && this._pointerDistance.check(evt)) {
      this._isSelectedObject = true;
      const gridItem = this.state.draggingGridItem?.resolve();
      if (gridItem && 'state' in gridItem && 'body' in gridItem.state && gridItem.state.body instanceof VizPanel) {
        const panel = gridItem.state.body;
        this._getDashboard().state.editPane.selectObject(panel, panel.state.key!, { force: true, multi: false });
      }
    }

    const dropTarget = this._getLayoutGridUnderMouse(evt) ?? this._sourceGrid;

    if (!dropTarget) {
      return;
    }

    if (dropTarget !== this._lastGrid) {
      this._lastGrid?.setIsDropTarget?.(false);
      this._lastGrid = dropTarget;

      if (dropTarget !== this._sourceGrid) {
        dropTarget.setIsDropTarget?.(true);
      }
    }
  }

  private _getDashboard(): DashboardScene {
    if (!(this.parent instanceof DashboardScene)) {
      throw new Error('Parent is not a DashboardScene');
    }

    return this.parent;
  }

  private _getLayoutGridUnderMouse(evt: MouseEvent): DashboardLayoutGrid | null {
    const elementsUnderPoint = document.elementsFromPoint(evt.clientX, evt.clientY);
    const cursorIsInSourceTarget = elementsUnderPoint.some((el) => el.getAttribute('data-grid-manager-key') ===
      this._sourceGrid?.state.key);

    if (cursorIsInSourceTarget) {
      return null;
    }

    const key = elementsUnderPoint
      ?.find((element) => element.getAttribute('data-grid-manager-key'))
      ?.getAttribute('data-grid-manager-key');

    if (!key) {
      return null;
    }

    const sceneObject = sceneGraph.findByKey(this._getDashboard(), key);

    if (!sceneObject || !isDashboardLayoutManager(sceneObject) || !isDashboardLayoutGrid(sceneObject)) {
      return null;
    }

    return sceneObject;
  }
}
