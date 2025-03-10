import { SceneObject, SceneObjectRef, VizPanel } from '@grafana/scenes';
import { ElementSelectionContextItem } from '@grafana/ui';

import { isBulkActionElement } from '../scene/types/BulkActionElement';
import { EditableDashboardElement, isEditableDashboardElement } from '../scene/types/EditableDashboardElement';
import { MultiSelectedEditableDashboardElement } from '../scene/types/MultiSelectedEditableDashboardElement';

import { MultiSelectedObjectsEditableElement } from './MultiSelectedObjectsEditableElement';
import { MultiSelectedVizPanelsEditableElement } from './MultiSelectedVizPanelsEditableElement';
import { VizPanelEditableElement } from './VizPanelEditableElement';
import { getEditableElementFor } from './shared';

export class ElementSelection {
  private selectedObjects?: Map<string, SceneObjectRef<SceneObject>>;
  private sameType?: boolean;

  private _isMultiSelection: boolean;

  constructor(values: Array<[string, SceneObjectRef<SceneObject>]>) {
    this.selectedObjects = new Map(values);
    this._isMultiSelection = values.length > 1;

    if (this.isMultiSelection) {
      this.sameType = this.checkSameType();
    }
  }

  private checkSameType() {
    const values = this.selectedObjects?.values();
    const firstType = values?.next().value?.resolve()?.constructor.name;

    if (!firstType) {
      return false;
    }

    for (let obj of values ?? []) {
      if (obj.resolve()?.constructor.name !== firstType) {
        return false;
      }
    }

    return true;
  }

  public hasValue(id: string) {
    return this.selectedObjects?.has(id);
  }

  public removeValue(id: string) {
    this.selectedObjects?.delete(id);

    if (this.selectedObjects && this.selectedObjects.size < 2) {
      this.sameType = undefined;
      this._isMultiSelection = false;
    }
  }

  public getStateWithValue(
    id: string,
    obj: SceneObject,
    isMulti: boolean
  ): { selection: Array<[string, SceneObjectRef<SceneObject>]>; contextItems: ElementSelectionContextItem[] } {
    const ref = obj.getRef();
    let contextItems = [{ id }];
    let selection: Array<[string, SceneObjectRef<SceneObject>]> = [[id, ref]];

    const entries = this.getSelectionEntries() ?? [];
    const items = entries.map(([key]) => ({ id: key }));

    if (isMulti) {
      selection = [[id, ref], ...entries];
      contextItems = [{ id }, ...items];
    }

    return { selection, contextItems };
  }

  public getStateWithoutValueAt(id: string): {
    entries: Array<[string, SceneObjectRef<SceneObject>]>;
    contextItems: ElementSelectionContextItem[];
  } {
    this.removeValue(id);
    const entries = this.getSelectionEntries() ?? [];
    const contextItems = entries.map(([key]) => ({ id: key }));

    return { entries, contextItems };
  }

  public getSelection(): SceneObject | SceneObject[] | undefined {
    if (this.isMultiSelection) {
      return this.getSceneObjects();
    }

    return this.getFirstObject();
  }

  public getSelectionEntries(): Array<[string, SceneObjectRef<SceneObject>]> {
    return Array.from(this.selectedObjects?.entries() ?? []);
  }

  public getFirstObject(): SceneObject | undefined {
    return this.selectedObjects?.values().next().value?.resolve();
  }

  public get isMultiSelection(): boolean {
    return this._isMultiSelection;
  }

  private getSceneObjects(): SceneObject[] {
    return Array.from(this.selectedObjects?.values() ?? []).map((obj) => obj.resolve());
  }

  public createSelectionElement() {
    if (this.isMultiSelection) {
      return this.createMultiSelectedElement();
    }

    return this.createSingleSelectedElement();
  }

  private createSingleSelectedElement(): EditableDashboardElement | undefined {
    const sceneObj = this.selectedObjects?.values().next().value?.resolve();
    return getEditableElementFor(sceneObj);
  }

  private createMultiSelectedElement(): MultiSelectedEditableDashboardElement | undefined {
    if (!this.isMultiSelection) {
      return;
    }

    const sceneObjects = this.getSceneObjects();

    if (this.sameType) {
      const firstObj = this.selectedObjects?.values().next().value?.resolve();

      if (firstObj instanceof VizPanel) {
        return new MultiSelectedVizPanelsEditableElement(sceneObjects.filter((obj) => obj instanceof VizPanel));
      }

      if (isEditableDashboardElement(firstObj!)) {
        return firstObj.createMultiSelectedElement?.(sceneObjects);
      }
    }

    const bulkActionElements = [];

    for (const sceneObject of sceneObjects) {
      if (sceneObject instanceof VizPanel) {
        const editableElement = new VizPanelEditableElement(sceneObject);
        bulkActionElements.push(editableElement);
      }

      if (isBulkActionElement(sceneObject)) {
        bulkActionElements.push(sceneObject);
      }
    }

    if (bulkActionElements.length) {
      return new MultiSelectedObjectsEditableElement(bulkActionElements);
    }

    return undefined;
  }
}
