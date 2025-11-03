import { PointerEvent as ReactPointerEvent } from 'react';

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
import { DashboardDropTarget, isDashboardDropTarget } from './types/DashboardDropTarget';

interface DashboardLayoutOrchestratorState extends SceneObjectState {
  draggingGridItem?: SceneObjectRef<SceneGridItemLike>;
}

export class DashboardLayoutOrchestrator extends SceneObjectBase<DashboardLayoutOrchestratorState> {
  private _sourceDropTarget: DashboardDropTarget | null = null;
  private _lastDropTarget: DashboardDropTarget | null = null;
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

  public startDraggingSync(evt: ReactPointerEvent, panel: VizPanel): void {
    this._pointerDistance.set(evt);
    this._isSelectedObject = false;

    const dropTarget = sceneGraph.findObject(panel, isDashboardDropTarget);

    if (!dropTarget || !isDashboardDropTarget(dropTarget)) {
      return;
    }

    this._sourceDropTarget = dropTarget;
    this._lastDropTarget = dropTarget;

    document.body.addEventListener('pointermove', this._onPointerMove);
    document.body.addEventListener('pointerup', this._stopDraggingSync);

    // Get the grid item if the panel is inside one (could be DashboardGridItem or AutoGridItem)
    const gridItem = panel.parent;
    if (gridItem && 'isDashboardLayoutItem' in gridItem) {
      this.setState({ draggingGridItem: gridItem.getRef() });
    } else {
      // If no grid item, we can't drag it properly
      console.warn('Panel is not inside a grid item, cannot drag');
      return;
    }
  }

  private _stopDraggingSync(_evt: PointerEvent) {
    const gridItem = this.state.draggingGridItem?.resolve();

    if (this._sourceDropTarget !== this._lastDropTarget) {
      // Wrapped in setTimeout to ensure that any event handlers are called
      // Useful for allowing react-grid-layout to remove placeholders, etc.
      setTimeout(() => {
        if (gridItem) {
          // Always use grid item dragging
          this._sourceDropTarget?.draggedGridItemOutside?.(gridItem);
          this._lastDropTarget?.draggedGridItemInside?.(gridItem);
        } else {
          console.warn('No grid item to drag');
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

    const dropTarget = this._getDropTargetUnderMouse(evt) ?? this._sourceDropTarget;

    if (!dropTarget) {
      return;
    }

    if (dropTarget !== this._lastDropTarget) {
      this._lastDropTarget?.setIsDropTarget?.(false);
      this._lastDropTarget = dropTarget;

      if (dropTarget !== this._sourceDropTarget) {
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

  private _getDropTargetUnderMouse(evt: MouseEvent): DashboardDropTarget | null {
    const elementsUnderPoint = document.elementsFromPoint(evt.clientX, evt.clientY);
    const cursorIsInSourceTarget = elementsUnderPoint.some(
      (el) => el.getAttribute('data-dashboard-drop-target-key') === this._sourceDropTarget?.state.key
    );

    if (cursorIsInSourceTarget) {
      return null;
    }

    const key = elementsUnderPoint
      ?.find((element) => element.getAttribute('data-dashboard-drop-target-key'))
      ?.getAttribute('data-dashboard-drop-target-key');

    if (!key) {
      return null;
    }

    const sceneObject = sceneGraph.findByKey(this._getDashboard(), key);

    if (!sceneObject || !isDashboardDropTarget(sceneObject)) {
      return null;
    }

    return sceneObject;
  }
}
