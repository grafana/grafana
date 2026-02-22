/**
 * REMOVE_TAB command
 *
 * Remove a tab by path. Optionally move contained panels to another group.
 */

import { z } from 'zod';

import { TabItem } from '../../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';

import { resolveLayoutPath, resolveParentPath } from './layoutPathResolver';
import { movePanelsToLayout } from './movePanelsHelper';
import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresNewDashboardLayouts, type MutationCommand } from './types';

export const removeTabPayloadSchema = payloads.removeTab;

export type RemoveTabPayload = z.infer<typeof removeTabPayloadSchema>;

export const removeTabCommand: MutationCommand<RemoveTabPayload> = {
  name: 'REMOVE_TAB',
  description: payloads.removeTab.description ?? '',

  payloadSchema: payloads.removeTab,
  permission: requiresNewDashboardLayouts,

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      const { path, moveContentTo } = payload;

      if (moveContentTo === path) {
        throw new Error(`moveContentTo cannot be the same path as the tab being removed`);
      }

      const resolved = resolveLayoutPath(scene.state.body, path);
      if (!(resolved.item instanceof TabItem)) {
        throw new Error(`Path "${path}" does not point to a tab`);
      }

      const { parent, segment } = resolveParentPath(scene.state.body, path);
      if (!(parent instanceof TabsLayoutManager)) {
        throw new Error(`Parent of "${path}" is not a TabsLayoutManager`);
      }

      if (moveContentTo) {
        const panels = resolved.item.state.layout.getVizPanels();
        if (panels.length > 0) {
          const targetResolved = resolveLayoutPath(scene.state.body, moveContentTo);
          movePanelsToLayout(panels, targetResolved.layoutManager);
        }
      }

      // Remove the tab
      const currentTabs = [...parent.state.tabs];
      currentTabs.splice(segment.index, 1);
      parent.setState({ tabs: currentTabs });

      return {
        success: true,
        changes: [{ path, previousValue: { title: resolved.item.state.title }, newValue: undefined }],
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
