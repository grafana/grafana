import { Dashboard } from '@grafana/schema';
import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';

import { jsonDiff } from '../settings/version-history/utils';

function _debounce<T>(f: (...args: T[]) => void, timeout: number) {
  let timeoutId: NodeJS.Timeout | undefined = undefined;
  return (...theArgs: T[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      f(...theArgs);
    }, timeout);
  };
}

self.onmessage = _debounce((e: MessageEvent<{ initial: Dashboard; changed: Dashboard }>) => {
  const result = detectDashboardChanges(e.data.initial, e.data.changed);
  self.postMessage(result);
}, 500);

export function detectDashboardChanges(
  changedSaveModel: DashboardV2Spec | Dashboard,
  initialSaveModel: DashboardV2Spec | Dashboard
) {
  // Calculate differences using the non-transformed to v2 spec values to be able to compare the initial and changed dashboard values
  const diff = jsonDiff(initialSaveModel, changedSaveModel);
  const diffCount = Object.values(diff).reduce((acc, cur) => acc + cur.length, 0);
  const hasMigratedToV2 = isDashboardV2Spec(changedSaveModel) && !isDashboardV2Spec(initialSaveModel);

  return {
    changedSaveModel,
    initialSaveModel,
    diffs: diff,
    diffCount,
    hasChanges: diffCount > 0,
    hasMigratedToV2,
  };
}

export function isDashboardV2Spec(obj: Dashboard | DashboardV2Spec): obj is DashboardV2Spec {
  return 'elements' in obj;
}
