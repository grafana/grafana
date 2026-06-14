/**
 * UPDATE_TAB command
 *
 * Update a tab's metadata (title) by path.
 */

import { type z } from 'zod';

import { t } from '@grafana/i18n';

import { ConditionalRenderingGroup } from '../../conditional-rendering/group/ConditionalRenderingGroup';
import { dashboardEditActions } from '../../edit-pane/shared';
import { TabItem } from '../../scene/layout-tabs/TabItem';

import { resolveLayoutPath } from './layoutPathResolver';
import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresNewDashboardLayouts, type MutationCommand } from './types';

const updateTabPayloadSchema = payloads.updateTab;

export type UpdateTabPayload = z.infer<typeof updateTabPayloadSchema>;

export const updateTabCommand: MutationCommand<UpdateTabPayload> = {
  name: 'UPDATE_TAB',
  description: payloads.updateTab.description ?? '',

  payloadSchema: payloads.updateTab,
  permission: requiresNewDashboardLayouts,
  readOnly: false,

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      const { path, spec } = payload;

      const resolved = resolveLayoutPath(scene.state.body, path);
      if (!(resolved.item instanceof TabItem)) {
        throw new Error(`Path "${path}" does not point to a tab`);
      }

      const tab = resolved.item;
      const previousValue = {
        title: tab.state.title,
        conditionalRendering: tab.state.conditionalRendering?.serialize(),
      };

      const stateBefore = {
        title: tab.state.title,
        repeatByVariable: tab.state.repeatByVariable,
        repeatedTabs: tab.state.repeatedTabs,
        $variables: tab.state.$variables,
        conditionalRendering: tab.state.conditionalRendering,
      };

      const newGroup =
        spec.conditionalRendering !== undefined
          ? ConditionalRenderingGroup.deserialize(spec.conditionalRendering)
          : undefined;

      dashboardEditActions.edit({
        description: t('dashboard.mutation-api.update-tab', 'Update tab'),
        source: tab,
        perform: () => {
          if (spec.title !== undefined) {
            tab.setState({ title: spec.title });
          }
          if (spec.repeat !== undefined) {
            tab.onChangeRepeat(spec.repeat?.value || undefined);
          }
          if (newGroup !== undefined) {
            tab.setState({ conditionalRendering: newGroup });
          }
        },
        undo: () => {
          tab.setState({
            title: stateBefore.title,
            repeatByVariable: stateBefore.repeatByVariable,
            repeatedTabs: stateBefore.repeatedTabs,
            $variables: stateBefore.$variables,
            conditionalRendering: stateBefore.conditionalRendering,
          });
        },
      });

      const currentSpec = {
        title: tab.state.title,
        conditionalRendering: tab.state.conditionalRendering?.serialize(),
      };

      return {
        success: true,
        data: { path, tab: { kind: 'TabsLayoutTab', spec: currentSpec } },
        changes: [{ path, previousValue, newValue: currentSpec }],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        changes: [],
      };
    }
  },
};
