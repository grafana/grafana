/**
 * END_PLANNING command
 *
 * Ends the plan preview and clears the dashboard back to empty, unconditionally: nothing but
 * RENDER_PLAN can add content to a preview (view mode, no editing), so every panel/section/
 * variable present is tautologically the whole plan.
 */
import type * as z from 'zod';

import { SceneVariableSet } from '@grafana/scenes';

import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';

import { payloads } from './schemas';
import { requiresEdit, type MutationCommand } from './types';

export type EndPlanningPayload = z.infer<typeof payloads.endPlanning>;

export const endPlanningCommand: MutationCommand<EndPlanningPayload> = {
  name: 'END_PLANNING',
  description: payloads.endPlanning.description ?? '',
  payloadSchema: payloads.endPlanning,
  permission: requiresEdit,
  readOnly: false,

  handler: async ({ planId }, { scene }) => {
    if (scene.state.planning?.planId !== planId) {
      return { success: false, error: 'The preview dashboard is no longer open.', changes: [] };
    }

    scene.setState({
      body: DefaultGridLayoutManager.createEmpty(),
      $variables: new SceneVariableSet({ variables: [] }),
      planning: undefined,
    });

    return { success: true, changes: [] };
  },
};
