import { type PanelInteractionPromotionContext } from '@grafana/data';
import { sceneGraph, type VizPanel } from '@grafana/scenes';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { getEffectiveTableTransformations } from '@grafana/ui/internal';
import { isDashboardV2Spec } from 'app/features/dashboard/api/utils';
import { TABLE_TRANSFORMATIONS_OWNER } from 'app/features/table/constants';

import { getDashboardSceneFor } from '../../../utils/utils';
import { getPanelIdForVizPanel, getVizPanelKeyForPanelId } from '../../../utils/utils-panels';

import { canPromoteAdHocChanges } from './utils';

/**
 * Runs the promotion handler of every interaction the panel declares, threading the v2 dashboard JSON through each one.
 * Returns the resulting dashboard JSON, or `undefined` when the changes cannot be promoted; the caller decides what to do
 * with it.
 */
export function promoteAdHocChanges(panel: VizPanel): DashboardV2Spec | undefined {
  if (!canPromoteAdHocChanges(panel)) {
    return undefined;
  }

  const runtimeTransformations = panel.getRuntimeTransformations();
  const transformations = getEffectiveTableTransformations(
    runtimeTransformations.get(TABLE_TRANSFORMATIONS_OWNER),
    runtimeTransformations.getSourceSeries(TABLE_TRANSFORMATIONS_OWNER),
    sceneGraph.getData(panel).state.data?.state
  );
  if (transformations.length === 0) {
    return undefined;
  }

  const scene = getDashboardSceneFor(panel);
  const dashboard = scene.getSaveModel();
  if (!isDashboardV2Spec(dashboard)) {
    return undefined;
  }

  const panelId = getPanelIdForVizPanel(panel);
  const interactions = panel.getPlugin()?.panelInteractions?.interactions ?? [];
  const context = {
    // Resolved here instead of via dashboardSceneGraph to avoid a circular import through DashboardScene.
    elementKey: scene.serializer.getElementIdForPanel(panelId) || getVizPanelKeyForPanelId(panelId),
    transformations,
  } satisfies PanelInteractionPromotionContext;

  // Panels declare one interaction today. Once applied interactions are tracked (URL or local storage),
  // only those will be promoted.
  return interactions.reduce((json, interaction) => interaction.promotionHandler(json, context), dashboard);
}
