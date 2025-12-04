import { PointerEvent as ReactPointerEvent } from 'react';

import { sceneGraph, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { createPointerDistance } from '@grafana/ui';

import { DashboardScene } from './DashboardScene';
import { DashboardLayoutGrid, isDashboardLayoutGrid } from './types/DashboardLayoutGrid';
import { DashboardLayoutItem } from './types/DashboardLayoutItem';
import { isDashboardLayoutManager } from './types/DashboardLayoutManager';

interface DashboardLayoutOrchestratorState extends SceneObjectState {}

export class DashboardLayoutOrchestrator extends SceneObjectBase<DashboardLayoutOrchestratorState> {
  private _sourceGrid: DashboardLayoutGrid | null = null;
  private _currentGrid: DashboardLayoutGrid | null = null;
  private _layoutItem: DashboardLayoutItem | null = null;
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
      document.body.classList.remove('dashboard-draggable-transparent-selection');
    };
  }

  public getDashboard(): DashboardScene {
    if (!(this.parent instanceof DashboardScene)) {
      throw new Error('Parent is not a DashboardScene');
    }

    return this.parent;
  }

  public startDraggingSync(evt: ReactPointerEvent, layoutItem: DashboardLayoutItem, layoutGrid: DashboardLayoutGrid) {
    this._pointerDistance.set(evt);

    this._isSelectedObject = false;
    this._sourceGrid = layoutGrid;
    this._currentGrid = layoutGrid;
    this._layoutItem = layoutItem;

    this._sourceGrid.setIsDropTarget?.(true, this._sourceGrid!, this._layoutItem!);

    document.body.addEventListener('pointermove', this._onPointerMove);
    document.body.addEventListener('pointerup', this._stopDraggingSync);
    document.body.classList.add('dashboard-draggable-transparent-selection');
  }

  private _onPointerMove(evt: PointerEvent) {
    this._selectVizPanelIfNeeded(evt);
    this._changeCurrentGridIfNeeded(evt);
  }

  private _selectVizPanelIfNeeded(evt: PointerEvent) {
    if (!this._isSelectedObject && this._layoutItem && this._pointerDistance.check(evt)) {
      const panel = this._getVizPanelFromLayoutItem();

      if (!panel) {
        return;
      }

      this._isSelectedObject = true;
      this.getDashboard().state.editPane.selectObject(panel, panel.state.key!, { force: true, multi: false });
    }
  }

  private _getVizPanelFromLayoutItem(): VizPanel | null {
    if (
      this._layoutItem &&
      'state' in this._layoutItem &&
      'body' in this._layoutItem.state &&
      this._layoutItem.state.body instanceof VizPanel
    ) {
      return this._layoutItem.state.body;
    }

    return null;
  }

  private _changeCurrentGridIfNeeded(evt: PointerEvent) {
    const currentGrid = this._getCurrentGrid(evt) ?? this._sourceGrid;

    if (!currentGrid) {
      return;
    }

    if (currentGrid !== this._currentGrid) {
      this._currentGrid?.setIsDropTarget?.(false, this._sourceGrid!, this._layoutItem!);
      this._currentGrid = currentGrid;

      if (currentGrid !== this._sourceGrid) {
        currentGrid.setIsDropTarget?.(true, this._sourceGrid!, this._layoutItem!);
      }
    }
  }

  private _getCurrentGrid(evt: MouseEvent): DashboardLayoutGrid | null {
    const elementsUnderPoint = document.elementsFromPoint(evt.clientX, evt.clientY);
    const cursorIsInSourceTarget = elementsUnderPoint.some(
      (el) => el.getAttribute('data-grid-manager-key') === this._sourceGrid?.state.key
    );

    if (cursorIsInSourceTarget) {
      return null;
    }

    const key = elementsUnderPoint
      ?.find((element) => element.getAttribute('data-grid-manager-key'))
      ?.getAttribute('data-grid-manager-key');

    if (!key) {
      return null;
    }

    const sceneObject = sceneGraph.findByKey(this.getDashboard(), key);

    if (!sceneObject || !isDashboardLayoutManager(sceneObject) || !isDashboardLayoutGrid(sceneObject)) {
      return null;
    }

    return sceneObject;
  }

  private _stopDraggingSync(_evt: PointerEvent) {
    document.body.removeEventListener('pointermove', this._onPointerMove);
    document.body.removeEventListener('pointerup', this._stopDraggingSync);
    document.body.classList.remove('dashboard-draggable-transparent-selection');

    // Wrapped in setTimeout to ensure that any event handlers are called
    // Useful for allowing react-grid-layout to remove placeholders, etc.
    setTimeout(() => {
      if (!this._sourceGrid || !this._currentGrid || !this._layoutItem) {
        return;
      }

      sceneGraph.findAllObjects(this.getDashboard(), (obj) => isDashboardLayoutManager(obj) && isDashboardLayoutGrid(obj)).forEach((obj) => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        (obj as DashboardLayoutGrid).stopOrchestratorSync?.(this._sourceGrid!, this._currentGrid!, this._layoutItem!);
      });

      this._isSelectedObject = false;
      this._sourceGrid = null;
      this._currentGrid = null;
      this._layoutItem = null;
    });
  }
}
