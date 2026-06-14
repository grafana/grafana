/**
 * REMOVE_TAB command
 *
 * Remove a tab by path. Optionally move contained panels to another group.
 */

import { type z } from 'zod';

import { dashboardEditActions } from '../../edit-pane/shared';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';

import { resolveLayoutPath, resolveParentPath } from './layoutPathResolver';
import { captureGridChildrenSnapshot, movePanelsToLayout, restoreGridChildrenSnapshot } from './movePanelsHelper';
import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresNewDashboardLayouts, type MutationCommand } from './types';

const removeTabPayloadSchema = payloads.removeTab;

export type RemoveTabPayload = z.infer<typeof removeTabPayloadSchema>;

export const removeTabCommand: MutationCommand<RemoveTabPayload> = {
  name: 'REMOVE_TAB',
  description: payloads.removeTab.description ?? '',

  payloadSchema: payloads.removeTab,
  permission: requiresNewDashboardLayouts,
  readOnly: false,

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

      const tabsBefore = [...parent.state.tabs];
      const slugBefore = parent.state.currentTabSlug;
      const tabsAfter = [...tabsBefore];
      tabsAfter.splice(segment.index, 1);

      let targetSnapshot: ReturnType<typeof captureGridChildrenSnapshot> | undefined;
      let panelsToMove: ReturnType<typeof resolved.item.state.layout.getVizPanels> = [];
      if (moveContentTo) {
        panelsToMove = resolved.item.state.layout.getVizPanels();
        if (panelsToMove.length > 0) {
          const targetResolved = resolveLayoutPath(scene.state.body, moveContentTo);
          targetSnapshot = captureGridChildrenSnapshot(targetResolved.layoutManager);
        }
      }

      const removedTab = resolved.item;
      dashboardEditActions.removeElement({
        removedObject: removedTab,
        source: parent,
        perform: () => {
          if (panelsToMove.length > 0) {
            const targetResolved = resolveLayoutPath(scene.state.body, moveContentTo!);
            movePanelsToLayout(panelsToMove, targetResolved.layoutManager);
          }
          parent.setState({ tabs: tabsAfter });
        },
        undo: () => {
          parent.setState({ tabs: tabsBefore, currentTabSlug: slugBefore });
          if (targetSnapshot) {
            restoreGridChildrenSnapshot(targetSnapshot);
          }
        },
      });

      return {
        success: true,
        data: { path },
        changes: [{ path, previousValue: { title: resolved.item.state.title }, newValue: null }],
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
