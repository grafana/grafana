/**
 * ADD_TAB command
 *
 * Add a new tab to the dashboard layout. If the target parent is not a
 * TabsLayout, the existing content is nested inside the requested tab
 * (preserving the original layout structure) rather than being flattened.
 */

import { z } from 'zod';

import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../../scene/layout-tabs/TabsLayoutManager';
import { isLayoutParent } from '../../scene/types/LayoutParent';

import { resolveLayoutPath, validateNesting } from './layoutPathResolver';
import { payloads } from './schemas';
import { enterEditModeIfNeeded, requiresNewDashboardLayouts, type MutationCommand } from './types';

export const addTabPayloadSchema = payloads.addTab;

export type AddTabPayload = z.infer<typeof addTabPayloadSchema>;

export const addTabCommand: MutationCommand<AddTabPayload> = {
  name: 'ADD_TAB',
  description: payloads.addTab.description ?? '',

  payloadSchema: payloads.addTab,
  permission: requiresNewDashboardLayouts,

  handler: async (payload, context) => {
    const { scene } = context;
    enterEditModeIfNeeded(scene);

    try {
      const { tab, parentPath, position } = payload;
      const resolved = resolveLayoutPath(scene.state.body, parentPath);
      const targetLayout = resolved.layoutManager;

      let tabsManager: TabsLayoutManager;
      let wasConverted = false;
      let newTabIndex: number;

      validateNesting(parentPath, 'tabs', targetLayout);

      if (targetLayout instanceof TabsLayoutManager) {
        tabsManager = targetLayout;

        const newTab = new TabItem({
          layout: DefaultGridLayoutManager.fromVizPanels([]),
          title: tab.spec.title,
          repeatByVariable: tab.spec.repeat?.value,
        });

        const currentTabs = [...tabsManager.state.tabs];
        newTabIndex =
          position !== undefined && position >= 0 && position <= currentTabs.length ? position : currentTabs.length;
        currentTabs.splice(newTabIndex, 0, newTab);
        tabsManager.setState({ tabs: currentTabs });
      } else {
        const layoutParent = targetLayout.parent;
        if (!layoutParent || !isLayoutParent(layoutParent)) {
          throw new Error('Cannot convert layout: parent is not a LayoutParent');
        }

        // Nest the existing layout inside the requested tab as-is,
        // preserving its structure (rows, grid, etc.).
        targetLayout.clearParent();
        const newTab = new TabItem({
          layout: targetLayout,
          title: tab.spec.title,
          repeatByVariable: tab.spec.repeat?.value,
        });

        tabsManager = new TabsLayoutManager({ tabs: [newTab] });
        newTabIndex = 0;

        layoutParent.switchLayout(tabsManager);
        wasConverted = true;
      }

      const newPath = parentPath === '/' ? `/tabs/${newTabIndex}` : `${parentPath}/tabs/${newTabIndex}`;

      const warnings: string[] = [];
      if (wasConverted) {
        warnings.push(
          'Root layout converted to TabsLayout. Previous paths are invalidated; call GET_LAYOUT to refresh.'
        );
      }

      return {
        success: true,
        data: { path: newPath },
        changes: [{ path: newPath, previousValue: undefined, newValue: { title: tab.spec.title } }],
        warnings: warnings.length > 0 ? warnings : undefined,
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
