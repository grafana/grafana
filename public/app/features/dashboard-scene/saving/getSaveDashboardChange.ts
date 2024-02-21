import { isEqual } from 'lodash';

import { AdHocVariableModel, TypedVariableModel } from '@grafana/data';
import { Dashboard } from '@grafana/schema';

import { DashboardScene } from '../scene/DashboardScene';
import { transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';
import { jsonDiff } from '../settings/version-history/utils';

import { DashboardChangeInfo } from './shared';

export function getSaveDashboardChange(
  dashboard: DashboardScene,
  saveTimeRange?: boolean,
  saveVariables?: boolean
): DashboardChangeInfo {
  const initialSaveModel = dashboard.getInitialSaveModel()!;

  if (dashboard.state.editPanel) {
    dashboard.state.editPanel.commitChanges();
  }

  const changedSaveModel = transformSceneToSaveModel(dashboard);
  const hasTimeChanged = getHasTimeChanged(changedSaveModel, initialSaveModel);

  const hasVariableValueChanges = applyVariableChanges(changedSaveModel, initialSaveModel, saveVariables);

  if (!saveTimeRange) {
    changedSaveModel.time = initialSaveModel.time;
  }

  const diff = jsonDiff(initialSaveModel, changedSaveModel);

  let diffCount = 0;
  for (const d of Object.values(diff)) {
    diffCount += d.length;
  }

  return {
    changedSaveModel,
    initialSaveModel,
    diffs: diff,
    diffCount,
    hasChanges: diffCount > 0,
    hasTimeChanges: hasTimeChanged,
    isNew: changedSaveModel.version === 0,
    hasVariableValueChanges,
  };
}

export function getHasTimeChanged(saveModel: Dashboard, originalSaveModel: Dashboard) {
  return saveModel.time?.from !== originalSaveModel.time?.from || saveModel.time?.to !== originalSaveModel.time?.to;
}

export function applyVariableChanges(saveModel: Dashboard, originalSaveModel: Dashboard, saveVariables?: boolean) {
  const originalVariables = originalSaveModel.templating?.list ?? [];
  const variablesToSave = saveModel.templating?.list ?? [];
  let hasVariableValueChanges = false;

  for (const variable of variablesToSave) {
    const original = originalVariables.find(({ name, type }) => name === variable.name && type === variable.type);

    if (!original) {
      continue;
    }

    // Old schema property that never should be in persisted model
    if (original.current && Object.hasOwn(original.current, 'selected')) {
      delete original.current.selected;
    }

    if (!isEqual(variable.current, original.current)) {
      hasVariableValueChanges = true;
    }

    if (!saveVariables) {
      const typed = variable as TypedVariableModel;
      if (typed.type === 'adhoc') {
        typed.filters = (original as AdHocVariableModel).filters;
      } else {
        variable.current = original.current;
        variable.options = original.options;
      }
    }
  }

  return hasVariableValueChanges;
}
