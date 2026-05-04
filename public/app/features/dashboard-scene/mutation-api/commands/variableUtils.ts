/**
 * Shared variable utilities for mutation commands.
 *
 * Contains helpers used across add/remove/update variable commands.
 */

import { type sceneGraph, SceneVariableSet } from '@grafana/scenes';

import type { DashboardScene } from '../../scene/DashboardScene';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { TabItem } from '../../scene/layout-tabs/TabItem';

import { type VariableScopeOwner } from './variableScope';

/**
 * Replace the dashboard's variable set with a new set containing the given variables.
 * This ensures consistent lifecycle behavior across add/remove/update operations.
 */
export function replaceVariableSet(
  scene: Parameters<typeof sceneGraph.getVariables>[0],
  variables: ReturnType<typeof sceneGraph.getVariables>['state']['variables']
): SceneVariableSet {
  const newVarSet = new SceneVariableSet({ variables });
  scene.setState({ $variables: newVarSet });
  newVarSet.activate();
  return newVarSet;
}

/**
 * Replace variables on the dashboard or on a row/tab section owner.
 * Clears `$variables` on row/tab when the list is empty (matches section deserialization).
 */
export function replaceOwnerVariableSet(
  owner: VariableScopeOwner,
  variables: ReturnType<typeof sceneGraph.getVariables>['state']['variables']
): SceneVariableSet | undefined {
  if (owner instanceof RowItem || owner instanceof TabItem) {
    if (variables.length === 0) {
      owner.setState({ $variables: undefined });
      return undefined;
    }

    const newVarSet = new SceneVariableSet({ variables });
    owner.setState({ $variables: newVarSet });
    newVarSet.activate();
    return newVarSet;
  }

  return replaceVariableSet(owner, variables);
}

export function getOwnerVariableArray(
  owner: VariableScopeOwner
): ReturnType<typeof sceneGraph.getVariables>['state']['variables'] {
  const vs = owner.state.$variables;
  return vs ? [...vs.state.variables] : [];
}

export function dashboardHasVariableNamed(scene: DashboardScene, name: string): boolean {
  const vs = scene.state.$variables;
  return Boolean(vs?.getByName(name));
}
