import { PointerEvent as ReactPointerEvent } from 'react';

import { sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
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
  private _grids: DashboardLayoutGrid[] = [];

  public constructor() {
    super({});

    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    return () => {
      document.body.removeEventListener('pointermove', this._onPointerMove);
      document.body.removeEventListener('pointerup', this._onPointerUp);
      document.body.classList.remove('dashboard-draggable-transparent-selection');
    };
  }

  private _getDashboard(): DashboardScene {
    if (!(this.parent instanceof DashboardScene)) {
      throw new Error('Parent is not a DashboardScene');
    }

    return this.parent;
  }

  private _findAllGrids(): DashboardLayoutGrid[] {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return sceneGraph.findAllObjects(
      this._getDashboard(),
      (obj) => isDashboardLayoutManager(obj) && isDashboardLayoutGrid(obj)
    ) as DashboardLayoutGrid[];
  }

  private _getCurrentGrid(evt: MouseEvent): DashboardLayoutGrid | null {
    const key = document
      .elementsFromPoint(evt.clientX, evt.clientY)
      .reverse()
      ?.find((element) => element.getAttribute('data-grid-manager-key'))
      ?.getAttribute('data-grid-manager-key');

    if (!key) {
      return null;
    }

    const grid = this._grids.find((grid) => grid.state.key === key);

    if (!grid) {
      return null;
    }

    return grid;
  }

  public startDragging(evt: ReactPointerEvent, layoutItem: DashboardLayoutItem, layoutGrid: DashboardLayoutGrid) {
    this._pointerDistance.set(evt);

    this._isSelectedObject = false;
    this._sourceGrid = layoutGrid;
    this._currentGrid = layoutGrid;
    this._layoutItem = layoutItem;

    this._grids = this._findAllGrids();

    this._grids.forEach((grid) =>
      grid.onDragStart?.(this._sourceGrid!, this._layoutItem!, evt.nativeEvent)
    );

    document.body.addEventListener('pointermove', this._onPointerMove);
    document.body.addEventListener('pointerup', this._onPointerUp);
    document.body.classList.add('dashboard-draggable-transparent-selection');
  }

  private _onPointerMove(evt: PointerEvent) {
    // Select the panel if needed
    if (!this._isSelectedObject && this._pointerDistance.check(evt)) {
      this._isSelectedObject = true;

      this._getDashboard().state.editPane.selectObject(
        this._layoutItem!.getElementBody()!,
        this._layoutItem!.getElementBody()!.state.key!,
        {
          force: true,
          multi: false,
        }
      );
    }

    this._currentGrid = this._getCurrentGrid(evt) ?? this._currentGrid;

    this._grids.forEach((grid) => grid.onDrag?.(this._sourceGrid!, this._currentGrid!, this._layoutItem!, evt));
  }

  private _onPointerUp(evt: PointerEvent) {
    document.body.removeEventListener('pointermove', this._onPointerMove);
    document.body.removeEventListener('pointerup', this._onPointerUp);
    document.body.classList.remove('dashboard-draggable-transparent-selection');

    // Wrapped in setTimeout to ensure that any event handlers are called
    // Useful for allowing react-grid-layout to remove placeholders, etc.
    setTimeout(() => {
      if (!this._sourceGrid || !this._currentGrid || !this._layoutItem) {
        return;
      }

      this._grids.forEach((obj) => obj.onDragStop?.(this._sourceGrid!, this._currentGrid!, this._layoutItem!, evt));

      this._isSelectedObject = false;
      this._sourceGrid = null;
      this._currentGrid = null;
      this._layoutItem = null;
    });
  }
}
