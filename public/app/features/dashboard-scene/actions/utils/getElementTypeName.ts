import { t } from '@grafana/i18n';
import {
  dataLayers,
  LocalValueVariable,
  SceneGridRow,
  type SceneObject,
  sceneUtils,
  SceneVariableSet,
  VizPanel,
} from '@grafana/scenes';

import { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { isEditableDashboardElement } from '../../scene/types/EditableDashboardElement';
import { isDashboardSceneLike } from '../../scene/types/dashboard';
import { LinkEdit } from '../../settings/links/LinkEdit';
import { getEditableVariableMetadata } from '../../settings/variables/editableVariablesMetadata';
import { isSceneVariable, isVariableEditable } from '../../settings/variables/utils';

/**
 * Lightweight version of `getEditableElementFor(obj)?.getEditableElementInfo().typeName`.
 *
 * The edit action helpers (add/remove/duplicate/move) only need the display type name for
 * undo descriptions, and they are imported eagerly by the layout managers. Resolving the
 * name here avoids constructing editable elements, whose modules pull in the whole edit
 * pane UI. The type names must stay in sync with each element's getEditableElementInfo().
 */
export function getElementTypeName(sceneObj: SceneObject | undefined | null): string | undefined {
  if (!sceneObj) {
    return undefined;
  }

  if (isEditableDashboardElement(sceneObj)) {
    return sceneObj.getEditableElementInfo().typeName;
  }

  if (sceneObj instanceof VizPanel) {
    return t('dashboard.sidebar.elements.panel', 'Panel');
  }

  if (sceneObj instanceof SceneGridRow) {
    return t('dashboard.sidebar.elements.row', 'Row');
  }

  if (isDashboardSceneLike(sceneObj)) {
    return t('dashboard.sidebar.elements.dashboard', 'Dashboard');
  }

  if (sceneObj instanceof SceneVariableSet) {
    return t('dashboard.sidebar.elements.variable-set', 'Variables');
  }

  if (sceneObj instanceof LocalValueVariable) {
    return t('dashboard.sidebar.elements.local-variable', 'Local variable');
  }

  if (isSceneVariable(sceneObj)) {
    if (!isVariableEditable(sceneObj)) {
      return undefined;
    }

    if (sceneUtils.isAdHocVariable(sceneObj)) {
      return t('dashboard.sidebar.elements.filter', 'Filter');
    }

    return t('dashboard.sidebar.elements.variable', '{{type}} variable', {
      type: getEditableVariableMetadata(sceneObj.state.type).name,
    });
  }

  if (sceneObj instanceof LinkEdit) {
    return t('dashboard.sidebar.elements.link', 'Link');
  }

  if (sceneObj instanceof DashboardDataLayerSet) {
    return t('dashboard.sidebar.elements.annotation-set', 'Annotations & Alerts');
  }

  if (sceneObj instanceof dataLayers.AnnotationsDataLayer) {
    return t('dashboard.sidebar.elements.annotation', 'Annotation');
  }

  return undefined;
}
