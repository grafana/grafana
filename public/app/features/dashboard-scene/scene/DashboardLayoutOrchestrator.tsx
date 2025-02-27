import { sceneGraph, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';

import { DashboardScene } from './DashboardScene';
import { DashboardDropTarget, isDashboardDropTarget } from './types/DashboardDropTarget';

interface DashboardLayoutOrchestratorState extends SceneObjectState {}

export class DashboardLayoutOrchestrator extends SceneObjectBase<DashboardLayoutOrchestratorState> {
  private _sourceDropTarget: DashboardDropTarget | null = null;
  private _lastDropTarget: DashboardDropTarget | null = null;
  private _panel: VizPanel | null = null;

  constructor() {
    super({});

    this._onPointerMove = this._onPointerMove.bind(this);
    this._stopDraggingSync = this._stopDraggingSync.bind(this);
  }

  public startDraggingSync(panel: VizPanel) {
    this._getDashboard().state.editPane.clearSelection();

    const dropTarget = sceneGraph.findObject(panel, isDashboardDropTarget);

    if (!dropTarget || !isDashboardDropTarget(dropTarget)) {
      return;
    }

    this._sourceDropTarget = dropTarget;
    this._lastDropTarget = dropTarget;
    this._panel = panel;

    document.body.addEventListener('pointermove', this._onPointerMove);
    document.body.addEventListener('pointerup', this._stopDraggingSync);
  }

  private _stopDraggingSync() {
    if (this._sourceDropTarget !== this._lastDropTarget) {
      // Wrapped in setTimeout to ensure that any event handlers are called
      // Useful for allowing react-grid-layout to remove placeholders etc.
      setTimeout(() => {
        this._sourceDropTarget?.draggedPanelOutside?.(this._panel!);
        this._lastDropTarget?.draggedPanelInside?.(this._panel!);
      });
    }

    document.body.removeEventListener('pointermove', this._onPointerMove);
    document.body.removeEventListener('pointerup', this._stopDraggingSync);
  }

  private _onPointerMove(evt: PointerEvent) {
    const dropTarget = this._getDropTargetUnderMouse(evt);

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
      .elementFromPoint(evt.clientX, evt.clientY)
      ?.closest('[data-dashboard-drop-target-key]')
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
