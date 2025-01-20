import { useMemo } from 'react';

import { SceneObject, SceneObjectRef, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import {
  EditableDashboardElement,
  isEditableDashboardElement,
  MultiSelectedEditableDashboardElement,
} from '../scene/types';

import { DashboardEditableElement } from './DashboardEditableElement';
import { MultiSelectedVizPanelsEditableElement } from './MultiSelectedVizPanelsEditableElement';
import { VizPanelEditableElement } from './VizPanelEditableElement';

export function useEditableElement(
  selectedObjects: Map<string, SceneObjectRef<SceneObject>> | undefined
): EditableDashboardElement | MultiSelectedEditableDashboardElement | undefined {
  return useMemo(() => {
    if (!selectedObjects || selectedObjects.size === 0) {
      return undefined;
    }

    const sceneObj = selectedObjects.values().next().value?.resolve();

    if (!sceneObj) {
      return undefined;
    }

    if (selectedObjects.size > 1) {
      return buildMultiSelectedElement(selectedObjects, sceneObj);
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
  }, [selectedObjects]);
}

function buildMultiSelectedElement(
  selectedObjects: Map<string, SceneObjectRef<SceneObject>>,
  firstObj: SceneObject
): MultiSelectedEditableDashboardElement | undefined {
  if (firstObj instanceof VizPanel) {
    return new MultiSelectedVizPanelsEditableElement(selectedObjects);
  }

  if (isEditableDashboardElement(firstObj)) {
    return firstObj.createMultiSelectedElement?.(selectedObjects);
  }

  return undefined;
}
