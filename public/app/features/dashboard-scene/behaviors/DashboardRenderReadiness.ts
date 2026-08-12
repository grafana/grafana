import { isEqual } from 'lodash';

import {
  MultiValueVariable,
  sceneGraph,
  SceneVariableSet,
  type SceneObject,
  VizPanel,
  type VariableValueSingle,
} from '@grafana/scenes';

import { AutoGridItem } from '../scene/layout-auto-grid/AutoGridItem';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { RowRepeaterBehavior } from '../scene/layout-default/RowRepeaterBehavior';
import { RowItem } from '../scene/layout-rows/RowItem';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { getRepeatLocalVariableValue } from '../utils/getRepeatLocalVariableValue';
import { getMultiVariableValues } from '../utils/utils';

/**
 * Checks whether the dashboard's scene structure reflects the current variable
 * values and every panel that should be visible has mounted and rendered.
 */
export function isDashboardRenderReady(dashboard: SceneObject, renderedPanelKeys: ReadonlySet<string>): boolean {
  const queryController = sceneGraph.getQueryController(dashboard);
  if (queryController?.state.isRunning) {
    return false;
  }

  if (sceneGraph.findAllObjects(dashboard, hasPendingRenderWork).length > 0) {
    return false;
  }

  const activePanels = sceneGraph.findAllObjects(
    dashboard,
    (obj): obj is VizPanel => obj instanceof VizPanel && obj.isActive
  );

  return activePanels.every((panel) => Boolean(panel.state.key) && renderedPanelKeys.has(panel.state.key!));
}

function hasPendingRenderWork(obj: SceneObject): boolean {
  if (obj instanceof SceneVariableSet) {
    return obj.isActive && obj.state.variables.some((variable) => variable.state.loading === true);
  }

  if (obj instanceof RowRepeaterBehavior) {
    if (!obj.isActive || !getRepeatVariable(obj.state.variableName, obj)) {
      return false;
    }

    const repeatedRows = obj.getRepeatedRows();
    return !obj.isRepeatComplete() || !repeatedRows || repeatedRows.some((row) => !row.isActive);
  }

  if (obj instanceof RowItem) {
    if (!obj.parent?.isActive || !obj.state.repeatByVariable) {
      return false;
    }

    const variable = getRepeatVariable(obj.state.repeatByVariable, obj.parent);
    if (!variable) {
      return false;
    }

    return !areRepeatsCurrent(variable, [obj, ...(obj.state.repeatedRows ?? [])], obj.state.repeatedRows !== undefined);
  }

  if (obj instanceof TabItem) {
    if (!obj.parent?.isActive || !obj.state.repeatByVariable) {
      return false;
    }

    const variable = getRepeatVariable(obj.state.repeatByVariable, obj.parent);
    if (!variable) {
      return false;
    }

    return !areRepeatsCurrent(variable, [obj, ...(obj.state.repeatedTabs ?? [])], obj.state.repeatedTabs !== undefined);
  }

  if (obj instanceof DashboardGridItem || obj instanceof AutoGridItem) {
    if (!obj.isActive || !obj.state.variableName) {
      return false;
    }

    const variable = getRepeatVariable(obj.state.variableName, obj);
    if (!variable) {
      return false;
    }

    return !areRepeatsCurrent(
      variable,
      [obj.state.body, ...(obj.state.repeatedPanels ?? [])],
      obj.state.repeatedPanels !== undefined
    );
  }

  return false;
}

function getRepeatVariable(name: string, context: SceneObject): MultiValueVariable | undefined {
  const variable = sceneGraph.lookupVariable(name, context);
  return variable instanceof MultiValueVariable ? variable : undefined;
}

function areRepeatsCurrent(variable: MultiValueVariable, repeats: SceneObject[], initialized: boolean): boolean {
  if (!initialized || sceneGraph.hasVariableDependencyInLoadingState(variable)) {
    return false;
  }

  const expectedValues = getExpectedRepeatValues(variable);
  const actualValues = repeats.map((repeat) => getRepeatLocalVariableValue(repeat, variable.state.name));

  return repeats.every((repeat) => repeat.isActive) && isEqual(actualValues, expectedValues);
}

function getExpectedRepeatValues(variable: MultiValueVariable): VariableValueSingle[] {
  const values = getMultiVariableValues(variable).values;
  return values.length > 0 ? values : [''];
}
