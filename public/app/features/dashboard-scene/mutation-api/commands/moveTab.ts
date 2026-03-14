/**
 * MOVE_TAB command
 *
 * Reorder a tab within its parent or move it to a different parent.
 */

import { z } from 'zod';

import { TabItem } from '../../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';

import { resolveLayoutPath, resolveParentPath } from './layoutPathResolver';
import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresNewDashboardLayouts, type MutationCommand } from './types';

export const moveTabPayloadSchema = payloads.moveTab;

export type MoveTabPayload = z.infer<typeof moveTabPayloadSchema>;

export const moveTabCommand: MutationCommand<MoveTabPayload> = {
  name: 'MOVE_TAB',
  description: payloads.moveTab.description ?? '',

  payloadSchema: payloads.moveTab,
  permission: requiresNewDashboardLayouts,

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      const { path, toParent, toPosition } = payload;

      const resolved = resolveLayoutPath(scene.state.body, path);
      if (!(resolved.item instanceof TabItem)) {
        throw new Error(`Path "${path}" does not point to a tab`);
      }

      const tab = resolved.item;
      const { parent: sourceParent, segment: sourceSegment } = resolveParentPath(scene.state.body, path);

      if (!(sourceParent instanceof TabsLayoutManager)) {
        throw new Error(`Source parent of "${path}" is not a TabsLayoutManager`);
      }

      // Determine destination
      let destParent: TabsLayoutManager;
      if (toParent) {
        const destResolved = resolveLayoutPath(scene.state.body, toParent);
        if (!(destResolved.layoutManager instanceof TabsLayoutManager)) {
          throw new Error(`Destination "${toParent}" is not a TabsLayoutManager`);
        }
        destParent = destResolved.layoutManager;
      } else {
        destParent = sourceParent;
      }

      // Remove from source
      const sourceTabs = [...sourceParent.state.tabs];
      sourceTabs.splice(sourceSegment.index, 1);
      sourceParent.setState({ tabs: sourceTabs });

      // Insert into destination
      const destTabs = sourceParent === destParent ? sourceTabs : [...destParent.state.tabs];
      const insertIndex =
        toPosition !== undefined && toPosition >= 0 && toPosition <= destTabs.length ? toPosition : destTabs.length;
      destTabs.splice(insertIndex, 0, tab);
      destParent.setState({ tabs: destTabs });

      const basePath = toParent ?? (path.substring(0, path.lastIndexOf('/tabs/')) || '/');
      const newPath = basePath === '/' ? `/tabs/${insertIndex}` : `${basePath}/tabs/${insertIndex}`;

      return {
        success: true,
        data: { path: newPath },
        changes: [{ path, previousValue: path, newValue: newPath }],
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
