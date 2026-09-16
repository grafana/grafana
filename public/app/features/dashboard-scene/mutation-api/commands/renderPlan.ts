/**
 * RENDER_PLAN command
 *
 * Renders a whole dashboard plan in one call: rows or tabs, each with its query-less
 * placeholder panels, plus any stand-in variables. This is the same shape every dashboard
 * load already builds a tree in one pass (deserializeRowsLayout/deserializeTabsLayout) --
 * a plan preview renders once and is never edited, so there is nothing to build up
 * incrementally the way ADD_ROW/ADD_TAB/ADD_PANEL are for a real, editable dashboard.
 *
 * Deliberately does not call enterEditModeIfNeeded: the preview is a static, view-mode
 * surface that never enters edit mode (see the sibling commands' own guard,
 * refuseWhilePlanning, for the handful of actions that are reachable without it).
 */
import type * as z from 'zod';

import { CustomVariable, SceneVariableSet, type SceneVariable, type VizPanel } from '@grafana/scenes';
import { defaultPanelSpec, type PanelKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { appEvents } from 'app/core/app_events';

import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { DashboardPlanningEvent } from '../../scene/planningEvents';
import { getPlanningPanelData, getPlanningVariableValues } from '../../scene/planningSampleData';
import { buildVizPanel } from '../../serialization/layoutSerializers/utils';
import { getVizPanelKeyForPanelId } from '../../utils/utils-panels';

import { payloads } from './schemas';
import { requiresEdit, type MutationCommand } from './types';

export type RenderPlanPayload = z.infer<typeof payloads.renderPlan>;

function buildPlanPanel(title: string, vizType: string, id: number): VizPanel {
  const base = defaultPanelSpec();
  const panelKind: PanelKind = {
    kind: 'Panel',
    spec: {
      ...base,
      id,
      title,
      vizConfig: { ...base.vizConfig, group: vizType },
    },
  };

  const vizPanel = buildVizPanel(panelKind, id, { withoutQueries: true });
  vizPanel.setState({ key: getVizPanelKeyForPanelId(id) });

  // buildVizPanel's own sample-vs-spec merge lets a real spec's options/fieldConfig win over the
  // sample (see layoutSerializers/utils.ts) -- correct when a caller supplies real ones, but this
  // command never does (its payload has no options/fieldConfig field at all), so the synthetic
  // spec's empty options/fieldConfig would otherwise clobber the sample it just set. Re-apply it
  // explicitly rather than widen that shared merge for a caller that will never have real values.
  const sample = getPlanningPanelData(title, vizType);
  vizPanel.setState({ options: sample.options, fieldConfig: sample.fieldConfig });

  return vizPanel;
}

export const renderPlanCommand: MutationCommand<RenderPlanPayload> = {
  name: 'RENDER_PLAN',
  description: payloads.renderPlan.description ?? '',
  payloadSchema: payloads.renderPlan,
  permission: requiresEdit,
  readOnly: false,

  handler: async (payload, { scene }) => {
    if (!scene.isActive) {
      return { success: false, error: 'The preview dashboard is no longer open.', changes: [] };
    }

    try {
      let nextPanelId = 1;
      const buildSection = (section: RenderPlanPayload['sections'][number]) =>
        DefaultGridLayoutManager.fromVizPanels(
          section.panels.map((panel) => buildPlanPanel(panel.title, panel.vizType, nextPanelId++))
        );

      const body =
        payload.layout === 'tabs'
          ? new TabsLayoutManager({
              tabs: payload.sections.map(
                (section) => new TabItem({ title: section.title, layout: buildSection(section) })
              ),
            })
          : new RowsLayoutManager({
              rows: payload.sections.map(
                (section) => new RowItem({ title: section.title, layout: buildSection(section) })
              ),
            });

      const variables: SceneVariable[] = (payload.variables ?? []).map(
        (name) => new CustomVariable({ name, query: getPlanningVariableValues().join(',') })
      );

      const { planId } = payload;
      const notify = (action: 'build' | 'dismiss') => {
        if (scene.state.planning?.planId === planId) {
          appEvents.publish(new DashboardPlanningEvent({ planId, action }));
        }
      };

      scene.setState({
        title: payload.title,
        description: payload.description,
        body,
        $variables: new SceneVariableSet({ variables }),
        planning: {
          planId,
          planTitle: payload.title,
          panelCount: payload.sections.reduce((count, section) => count + section.panels.length, 0),
          onBuild: () => notify('build'),
          onDismiss: () => notify('dismiss'),
        },
      });

      return { success: true, changes: [{ path: '/', previousValue: null, newValue: payload.title }] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        changes: [],
      };
    }
  },
};
