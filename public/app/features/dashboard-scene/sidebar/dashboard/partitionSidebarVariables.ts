import { t } from '@grafana/i18n';
import { type SceneVariable, sceneUtils } from '@grafana/scenes';

import { partitionVariablesByDisplay } from '../../settings/variables/partitionVariables';
import { isVariableEditable } from '../../settings/variables/utils';
import { getPredefinedOrigin, type PredefinedControlSourceRef } from '../../utils/predefinedVariables';

export function isFilterOrGroupByVariable(variable: SceneVariable): boolean {
  return sceneUtils.isAdHocVariable(variable) || sceneUtils.isGroupByVariable(variable);
}

/**
 * Splits dashboard variables into the local list and the opted-in global/folder groups.
 * Snapshot and other non-editable variables stay out of every group.
 * Filter and group-by variables are omitted when `excludeFilters` is set, so the
 * Variables section and the Filters section can share this split.
 */
export function partitionSidebarVariables(
  variables: SceneVariable[],
  { includePredefined, excludeFilters }: { includePredefined: boolean; excludeFilters: boolean }
): { local: SceneVariable[]; global: SceneVariable[]; folder: SceneVariable[] } {
  const local: SceneVariable[] = [];
  const global: SceneVariable[] = [];
  const folder: SceneVariable[] = [];

  for (const variable of variables) {
    if (excludeFilters && isFilterOrGroupByVariable(variable)) {
      continue;
    }

    const origin = getPredefinedOrigin(variable.state.origin);
    if (origin) {
      if (!includePredefined) {
        continue;
      }
      if (origin.type === 'global') {
        global.push(variable);
      } else {
        folder.push(variable);
      }
      continue;
    }

    if (!isVariableEditable(variable)) {
      continue;
    }

    local.push(variable);
  }

  return { local, global, folder };
}

export function countSidebarVariables(groups: {
  local: SceneVariable[];
  global: SceneVariable[];
  folder: SceneVariable[];
}): number {
  return groups.local.length + groups.global.length + groups.folder.length;
}

export interface SidebarDisplayBucket {
  /** Opted-in global variables, then folder variables. Not draggable. */
  readOnly: SceneVariable[];
  editable: SceneVariable[];
}

/**
 * Places opted-in global and folder variables into the same display buckets as
 * dashboard variables: above the dashboard, the controls menu, or hidden.
 */
export function groupSidebarVariablesByDisplay(
  variables: SceneVariable[],
  options: { includePredefined: boolean; excludeFilters: boolean }
): { visible: SidebarDisplayBucket; controlsMenu: SidebarDisplayBucket; hidden: SidebarDisplayBucket } {
  const { local, global, folder } = partitionSidebarVariables(variables, options);
  const globalDisplay = partitionVariablesByDisplay(global);
  const folderDisplay = partitionVariablesByDisplay(folder);
  const localDisplay = partitionVariablesByDisplay(local);

  return {
    visible: {
      readOnly: [...globalDisplay.visible, ...folderDisplay.visible],
      editable: localDisplay.visible,
    },
    controlsMenu: {
      readOnly: [...globalDisplay.controlsMenu, ...folderDisplay.controlsMenu],
      editable: localDisplay.controlsMenu,
    },
    hidden: {
      readOnly: [...globalDisplay.hidden, ...folderDisplay.hidden],
      editable: localDisplay.hidden,
    },
  };
}

export function predefinedScopeTooltip(origin: PredefinedControlSourceRef): string {
  return origin.type === 'global'
    ? t('dashboard.sidebar.variable.defined-on-global-level', 'This variable is defined on the global level')
    : t('dashboard.sidebar.variable.defined-on-folder-level', 'This variable is defined on the folder level');
}
