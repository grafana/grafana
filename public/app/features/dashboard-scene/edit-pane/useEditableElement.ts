import { useMemo } from 'react';

import { SceneObject, SceneObjectRef, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { BulkRowItemsElement } from '../scene/layout-rows/BulkRowItemsElement';
import { RowItem } from '../scene/layout-rows/RowItem';
import { BulkEditableDashboardElements, EditableDashboardElement, isEditableDashboardElement } from '../scene/types';

import { BulkVizPanelsEditableElement } from './BulkVizPanelsEditableElement';
import { DashboardEditableElement } from './DashboardEditableElement';
import { VizPanelEditableElement } from './VizPanelEditableElement';

export function useEditableElement(
  selectedObjects: Array<SceneObjectRef<SceneObject>> | undefined
): EditableDashboardElement | BulkEditableDashboardElements | undefined {
  return useMemo(() => {
    if (!selectedObjects || selectedObjects.length === 0) {
      return undefined;
    }

    if (selectedObjects.length > 1) {
      return buildMultiSelectionElement(selectedObjects);
    }

    const sceneObj = selectedObjects[0].resolve();

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

function buildMultiSelectionElement(
  selectedObjects: Array<SceneObjectRef<SceneObject>>
): BulkEditableDashboardElements | undefined {
  const firstObj = selectedObjects[0].resolve();
  if (firstObj instanceof VizPanel) {
    return new BulkVizPanelsEditableElement(selectedObjects);
  }

  if (firstObj instanceof RowItem) {
    return new BulkRowItemsElement(selectedObjects);
  }

  return undefined;
}
