import { PointerEvent as ReactPointerEvent } from 'react';

import { sceneGraph, SceneObjectBase, SceneObjectRef, SceneObjectState, VizPanel } from '@grafana/scenes';
import { createPointerDistance } from '@grafana/ui';

import { DashboardScene } from './DashboardScene';
import { DashboardDropTarget, isDashboardDropTarget } from './types/DashboardDropTarget';

interface DashboardLayoutOrchestratorState extends SceneObjectState {
  draggingPanel?: SceneObjectRef<VizPanel>;
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

    this.setState({ draggingPanel: panel.getRef() });
  }

  private _stopDraggingSync(_evt: PointerEvent) {
    const panel = this.state.draggingPanel?.resolve();

    if (this._sourceDropTarget !== this._lastDropTarget) {
      // Wrapped in setTimeout to ensure that any event handlers are called
      // Useful for allowing react-grid-layout to remove placeholders, etc.
      setTimeout(() => {
        this._sourceDropTarget?.draggedPanelOutside?.(panel!);
        this._lastDropTarget?.draggedPanelInside?.(panel!);
      });
    }

    document.body.removeEventListener('pointermove', this._onPointerMove);
    document.body.removeEventListener('pointerup', this._stopDraggingSync);

    this.setState({ draggingPanel: undefined });
  }

  private _onPointerMove(evt: PointerEvent) {
    if (!this._isSelectedObject && this.state.draggingPanel && this._pointerDistance.check(evt)) {
      this._isSelectedObject = true;
      const panel = this.state.draggingPanel?.resolve();
      this._getDashboard().state.editPane.selectObject(panel, panel.state.key!, { force: true, multi: false });
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
    const key = document
      .elementsFromPoint(evt.clientX, evt.clientY)
      ?.find((element) => {
        const key = element.getAttribute('data-dashboard-drop-target-key');

        return !!key && key !== this._sourceDropTarget?.state.key;
      })
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
