import { SceneObject, SceneObjectRef, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import {
  EditableDashboardElement,
  isBulkActionElement,
  isEditableDashboardElement,
  MultiSelectedEditableDashboardElement,
} from '../scene/types';

import { DashboardEditableElement } from './DashboardEditableElement';
import { MultiSelectedObjectsEditableElement } from './MultiSelectedObjectsEditableElement';
import { MultiSelectedVizPanelsEditableElement } from './MultiSelectedVizPanelsEditableElement';
import { VizPanelEditableElement } from './VizPanelEditableElement';

export class ElementSelectionAdapter {
  public selectedObjects?: Map<string, SceneObjectRef<SceneObject>>;

  private isMultiSelection: boolean;
  private sameType: boolean;

  constructor(values: Array<[string, SceneObjectRef<SceneObject>]>) {
    this.selectedObjects = new Map(values);
    this.isMultiSelection = values.length > 1;
    this.sameType = this.isMultiSelection && this.checkSameType();
  }

  private checkSameType() {
    let firstType = this.selectedObjects?.values().next().value?.resolve()?.constructor.name;

    for (let obj of this.selectedObjects?.values() ?? []) {
      if (obj.resolve()?.constructor.name !== firstType) {
        return false;
      }
    }

    return true;
  }

  public getSelection(): SceneObject | SceneObject[] | undefined {
    if (this.isMultiSelection) {
      return this.getSceneObjects();
    }

    return this.selectedObjects?.values().next().value?.resolve();
  }

  public getFirstObject(): SceneObject | undefined {
    return this.selectedObjects?.values().next().value?.resolve();
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

    if (!sceneObj) {
      return undefined;
    }

    if (isEditableDashboardElement(sceneObj)) {
      return sceneObj;
    }

    if (sceneObj instanceof VizPanel) {
      return new VizPanelEditableElement(sceneObj);
    }

    if (sceneObj instanceof DashboardScene) {
      return new DashboardEditableElement(sceneObj);
    }

    return undefined;
  }

  private createMultiSelectedElement(): MultiSelectedEditableDashboardElement | undefined {
    if (!this.isMultiSelection) {
      return;
    }

    const sceneObjects = this.getSceneObjects();

    if (this.sameType) {
      const firstObj = this.selectedObjects?.values().next().value?.resolve();

      if (firstObj instanceof VizPanel) {
        return new MultiSelectedVizPanelsEditableElement(sceneObjects);
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
