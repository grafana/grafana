import { useSessionStorage } from 'react-use';

import { SceneObject, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { EditableDashboardElement, isEditableDashboardElement } from '../scene/types/EditableDashboardElement';

import { DashboardEditableElement } from './DashboardEditableElement';
import { VizPanelEditableElement } from './VizPanelEditableElement';

export function useEditPaneCollapsed() {
  return useSessionStorage('grafana.dashboards.edit-pane.isCollapsed', false);
}

export function getEditableElementFor(sceneObj: SceneObject | undefined): EditableDashboardElement | undefined {
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
