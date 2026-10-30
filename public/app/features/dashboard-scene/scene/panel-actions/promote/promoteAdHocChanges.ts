import { type PanelInteractionPromotionContext } from '@grafana/data';
import { type VizPanel } from '@grafana/scenes';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { isDashboardV2Spec } from 'app/features/dashboard/api/utils';
import { TABLE_TRANSFORMATIONS_OWNER } from 'app/features/table/constants';

import { dashboardSceneGraph } from '../../../utils/dashboardSceneGraph';
import { getDashboardSceneFor } from '../../../utils/utils';

import { canPromoteAdHocChanges } from './utils';

/**
 * Runs the promotion path of every interaction the panel declares, threading the v2 dashboard JSON through each one.
 * Returns the resulting dashboard JSON, or `undefined` when the changes cannot be promoted; the caller decides what to do
 * with it.
 */
export function promoteAdHocChanges(panel: VizPanel): DashboardV2Spec | undefined {
  if (!canPromoteAdHocChanges(panel)) {
    return undefined;
  }

  const dashboard = getDashboardSceneFor(panel).getSaveModel();
  if (!isDashboardV2Spec(dashboard)) {
    return undefined;
  }

  const interactions = panel.getPlugin()?.panelInteractions?.interactions ?? [];
  const context = {
    elementKey: dashboardSceneGraph.getElementIdentifierForVizPanel(panel),
    transformations: panel.getRuntimeTransformations().get(TABLE_TRANSFORMATIONS_OWNER),
  } satisfies PanelInteractionPromotionContext;

  // Panels declare one interaction today. Once applied interactions are tracked (URL or local storage),
  // only those will be promoted.
  return interactions.reduce((json, interaction) => interaction.promotionPath(json, context), dashboard);
}
