import {
  dataLayers,
  LocalValueVariable,
  SceneGridRow,
  type SceneObject,
  SceneVariableSet,
  VizPanel,
} from '@grafana/scenes';

import { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { DashboardScene } from '../../scene/DashboardScene';
import { SceneGridRowEditableElement } from '../../scene/layout-default/SceneGridRowEditableElement';
import { type EditableDashboardElement, isEditableDashboardElement } from '../../scene/types/EditableDashboardElement';
import { AnnotationEditableElement } from '../../settings/annotations/AnnotationEditableElement';
import { AnnotationSetEditableElement } from '../../settings/annotations/AnnotationSetEditableElement';
import { LinkEdit, LinkEditEditableElement } from '../../settings/links/LinkAddEditableElement';
import { LocalVariableEditableElement } from '../../settings/variables/LocalVariableEditableElement';
import { VariableEditableElement } from '../../settings/variables/VariableEditableElement';
import { VariableSetEditableElement } from '../../settings/variables/VariableSetEditableElement';
import { isSceneVariable, isVariableEditable } from '../../settings/variables/utils';
import { VizPanelEditableElement } from '../../sidebar/VizPanelEditableElement';
import { DashboardEditableElement } from '../../sidebar/dashboard/DashboardEditableElement';

export function getEditableElementFor(sceneObj: SceneObject | undefined | null): EditableDashboardElement | undefined {
  if (!sceneObj) {
    return undefined;
  }

  if (isEditableDashboardElement(sceneObj)) {
    return sceneObj;
  }

  if (sceneObj instanceof VizPanel) {
    return new VizPanelEditableElement(sceneObj);
  }

  if (sceneObj instanceof SceneGridRow) {
    return new SceneGridRowEditableElement(sceneObj);
  }

  if (sceneObj instanceof DashboardScene) {
    return new DashboardEditableElement(sceneObj);
  }

  if (sceneObj instanceof SceneVariableSet) {
    return new VariableSetEditableElement(sceneObj);
  }

  if (sceneObj instanceof LocalValueVariable) {
    return new LocalVariableEditableElement(sceneObj);
  }

  if (isSceneVariable(sceneObj)) {
    if (!isVariableEditable(sceneObj)) {
      return undefined;
    }
    return new VariableEditableElement(sceneObj);
  }

  if (sceneObj instanceof LinkEdit) {
    return new LinkEditEditableElement(sceneObj);
  }

  if (sceneObj instanceof DashboardDataLayerSet) {
    return new AnnotationSetEditableElement(sceneObj);
  }

  if (sceneObj instanceof dataLayers.AnnotationsDataLayer) {
    return new AnnotationEditableElement(sceneObj);
  }

  return undefined;
}
