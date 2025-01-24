import { useMemo } from 'react';

import { SceneObject, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { EditableDashboardElement, isEditableDashboardElement } from '../scene/types';

import { DashboardEditableElement } from './DashboardEditableElement';
import { VizPanelEditableElement } from './VizPanelEditableElement';

export function useEditableElement(sceneObj: SceneObject | undefined): EditableDashboardElement | undefined {
  return useMemo(() => {
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
  }, [sceneObj]);
}
