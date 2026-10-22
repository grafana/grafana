import { type VizPanel } from '@grafana/scenes';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { PANEL_AD_HOC_TRANSFORMATIONS_OWNER } from '@grafana/ui';
import { isDashboardV2Spec } from 'app/features/dashboard/api/utils';

import { V2DashboardSerializer } from '../../serialization/DashboardSceneSerializer';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { getDashboardSceneFor } from '../../utils/utils';
import { type DashboardScene } from '../DashboardScene';

/** Ad hoc changes can only be promoted into dashboards that use the v2 schema. */
export function canPromoteAdHocChanges(dashboard: DashboardScene): boolean {
  return dashboard.serializer instanceof V2DashboardSerializer;
}

/**
 * Runs the promotion path of every interaction the panel declares, threading the v2 dashboard JSON through each one.
 * Returns the resulting dashboard JSON, or `undefined` for dashboards that are not v2; the caller decides what to do
 * with it.
 */
export function promoteAdHocChanges(panel: VizPanel): DashboardV2Spec | undefined {
  const scene = getDashboardSceneFor(panel);
  if (!canPromoteAdHocChanges(scene)) {
    return undefined;
  }

  const dashboard = scene.getSaveModel();
  if (!isDashboardV2Spec(dashboard)) {
    return undefined;
  }

  const interactions = panel.getPlugin()?.panelInteractions?.interactions ?? [];
  const context = {
    elementKey: dashboardSceneGraph.getElementIdentifierForVizPanel(panel),
    transformations: panel.getRuntimeTransformations().get(PANEL_AD_HOC_TRANSFORMATIONS_OWNER),
  };

  // Panels declare one interaction today. Once applied interactions are tracked (URL or local storage),
  // only those will be promoted.
  return interactions.reduce((json, interaction) => interaction.promotionPath(json, context), dashboard);
}
