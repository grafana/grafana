import { Dashboard } from '@grafana/schema';

import { Diffs } from '../settings/version-history/utils';

export interface DashboardChangeInfo {
  changedSaveModel: Dashboard;
  initialSaveModel: Dashboard;
  diffs: Diffs;
  diffCount: number;
  hasChanges: boolean;
  hasTimeChanged: boolean;
  hasVariableValuesChanged: boolean;
}
