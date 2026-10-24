import { BusEventWithPayload } from '@grafana/data';
import { type VizPanel } from '@grafana/scenes';
import { isDashboardV2Spec } from 'app/features/dashboard/api/utils';

import { getDashboardSceneLike } from '../../types/dashboard';

/**
 * Action to ask the dashboard to save the panel's ad hoc changes. The save is handled on the dashboard side, see usePromotePanelAdHocChanges.
 */
export class PromotePanelAdHocChangesEvent extends BusEventWithPayload<{ panel: VizPanel }> {
  static type = 'promote-panel-adhoc-changes';
}

export function canPromoteAdHocChanges(panel: VizPanel): boolean {
  const dashboard = getDashboardSceneLike(panel);

  return isDashboardV2Spec(dashboard.getInitialSaveModel()) && !dashboard.isLibraryPanel(panel);
}
