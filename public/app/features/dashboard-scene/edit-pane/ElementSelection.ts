import { SceneObject, SceneObjectRef } from '@grafana/scenes';
import { ElementSelectionContextItem } from '@grafana/ui';

import { isBulkActionElement } from '../scene/types/BulkActionElement';
import { EditableDashboardElement } from '../scene/types/EditableDashboardElement';

import { MultiSelectedObjectsEditableElement } from './MultiSelectedObjectsEditableElement';
import { getEditableElementFor } from './shared';

export class ElementSelection {
  private selectedObjects: Map<string, SceneObjectRef<SceneObject>>;
  private sameType?: boolean;
  private _isMultiSelection: boolean;
  private _isNewElement = false;

  constructor(values: Array<[string, SceneObjectRef<SceneObject>]>) {
    this.selectedObjects = new Map(values);
    this._isMultiSelection = values.length > 1;

    if (this.isMultiSelection) {
      this.sameType = this.checkSameType();
    }
  }

  public markAsNewElement() {
    this._isNewElement = true;
  }

  public isNewElement() {
    return this._isNewElement;
  }

  private checkSameType() {
    const values = this.selectedObjects.values();
    const firstType = values.next().value?.resolve().constructor.name;

    if (!firstType) {
      return false;
    }

    for (let obj of values ?? []) {
      if (obj.resolve().constructor.name !== firstType) {
        return false;
      }
    }

    return true;
  }

  public hasValue(id: string) {
    return this.selectedObjects.has(id);
  }

  public removeValue(id: string) {
    this.selectedObjects.delete(id);

    if (this.selectedObjects.size < 2) {
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
    return Array.from(this.selectedObjects.entries());
  }

  public getFirstObject(): SceneObject | undefined {
    return this.selectedObjects.values().next().value?.resolve();
  }

  public get isMultiSelection(): boolean {
    return this._isMultiSelection;
  }

  private getSceneObjects(): SceneObject[] {
    return Array.from(this.selectedObjects.values() ?? []).map((obj) => obj.resolve());
  }

  public createSelectionElement(): EditableDashboardElement | undefined {
    const sceneObjects = this.getSceneObjects();

    if (sceneObjects.length === 0) {
      return undefined;
    }

    const firstElement = getEditableElementFor(sceneObjects[0]);

    if (!firstElement) {
      return undefined;
    }

    if (sceneObjects.length === 1) {
      return firstElement;
    }

    if (this.sameType && firstElement.createMultiSelectedElement) {
      const elements = sceneObjects.map((obj) => getEditableElementFor(obj)!);
      return firstElement.createMultiSelectedElement(elements);
    }

    const bulkActionElements = [];

    for (const sceneObject of sceneObjects) {
      const element = getEditableElementFor(sceneObject);

      if (element && isBulkActionElement(element)) {
        bulkActionElements.push(element);
      }
    }

    if (bulkActionElements.length) {
      return new MultiSelectedObjectsEditableElement(bulkActionElements);
    }

    return undefined;
  }
}
